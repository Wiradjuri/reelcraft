"""ASGI application factory."""

from __future__ import annotations

import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.ai.catalog import get_catalog
from app.ai.router import AIRouter
from app.api.deps import Container
from app.api.routes import ai_settings, auth, brands, catalog, generations, health, library, workspace
from app.core.config import Settings, get_settings
from app.core.errors import AppError, RateLimited
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import RateLimiter
from app.core.security import SecretBox
from app.db.session import Database

log = get_logger(__name__)

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_HEADER = "x-requested-with"


def _error_response(status: int, payload: dict[str, object], headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse({"error": payload}, status_code=status, headers=headers)


def create_app(settings: Settings | None = None, router: AIRouter | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_json)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        database = Database(settings)
        app.state.container = Container(
            settings=settings,
            database=database,
            router=router or AIRouter(get_catalog(settings.ai_model_catalog_path)),
            secret_box=SecretBox(settings.resolve_encryption_key()),
            rate_limiter=RateLimiter(),
        )
        log.info("app.started", environment=settings.environment, platform_ai=settings.platform_ai_provider)
        yield
        await database.dispose()

    app = FastAPI(
        title=f"{settings.app_name} API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/api/openapi.json",
    )

    # --- Middleware (last added runs first) ---------------------------------------
    @app.middleware("http")
    async def guard_and_log(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        request_id = request.headers.get("x-request-id", "")[:64] or uuid.uuid4().hex
        structlog.contextvars.bind_contextvars(request_id=request_id)
        started = time.perf_counter()
        try:
            if request.url.path.startswith(settings.api_prefix):
                if request.method in UNSAFE_METHODS and request.headers.get(CSRF_HEADER) != "reelcraft":
                    # Custom header forces a CORS preflight, blocking cross-site form posts.
                    return _error_response(
                        403,
                        AppError(
                            "Please refresh the page and try again.", title="Request blocked", code="csrf"
                        ).to_dict(),
                    )
                length = request.headers.get("content-length")
                if length and length.isdigit() and int(length) > settings.max_request_bytes:
                    return _error_response(
                        413,
                        AppError(
                            "That request is too large.", title="Too much data", code="payload_too_large"
                        ).to_dict(),
                    )
            response = await call_next(request)
        finally:
            structlog.contextvars.unbind_contextvars("request_id")
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith(settings.api_prefix):
            response.headers["Cache-Control"] = "no-store"
            log.info(
                "http.request",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=int((time.perf_counter() - started) * 1000),
                request_id=request_id,
            )
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-Requested-With", "X-Request-ID"],
    )
    if settings.trusted_hosts != ["*"]:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

    # --- Error handling -------------------------------------------------------------
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            log.warning("app.error", code=exc.code, status=exc.status_code)
        headers = {"Retry-After": str(exc.retry_after)} if isinstance(exc, RateLimited) else None
        return _error_response(exc.status_code, exc.to_dict(), headers)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path")),
                "message": str(err["msg"]).removeprefix("Value error, "),
            }
            for err in exc.errors()
        ]
        first = errors[0]["message"] if errors else "Some of the information provided isn't valid."
        return _error_response(
            422,
            {
                "code": "validation_error",
                "title": "Please check the highlighted fields",
                "message": first,
                "retryable": False,
                "details": {"errors": errors},
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        title = "We couldn't find that" if exc.status_code == 404 else "Request failed"
        return _error_response(
            exc.status_code,
            {
                "code": f"http_{exc.status_code}",
                "title": title,
                "message": str(exc.detail),
                "retryable": False,
                "details": {},
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
        log.exception("app.unhandled_error", error_type=type(exc).__name__)
        return _error_response(
            500,
            {
                "code": "internal_error",
                "title": "Something went wrong on our side",
                "message": "We've logged the problem. Please try again in a moment.",
                "retryable": True,
                "details": {},
            },
        )

    # --- Routes -----------------------------------------------------------------------
    for module in (health, auth, workspace, catalog, brands, generations, library, ai_settings):
        app.include_router(module.router, prefix=settings.api_prefix)

    _mount_frontend(app, settings)
    return app


def _mount_frontend(app: FastAPI, settings: Settings) -> None:
    """Serve the built single-page app when present (single-process/packaged deployments)."""
    dist = Path(settings.frontend_dist_dir) if settings.frontend_dist_dir else None
    if dist is None or not (dist / "index.html").exists():
        return
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    index = dist / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> Response:
        if path == "api" or path.startswith("api/"):
            return _error_response(404, {"code": "not_found", "title": "Not found", "message": "", "details": {}})
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
