from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.api.deps import ContainerDep, ContextDep, DbDep
from app.core.config import Settings
from app.schemas.account import LoginRequest, SessionOut, SignupRequest
from app.services.auth import AuthService
from app.services.workspace import session_out

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/signup", response_model=SessionOut, status_code=201)
async def signup(
    payload: SignupRequest, request: Request, response: Response, db: DbDep, c: ContainerDep
) -> SessionOut:
    c.rate_limiter.hit(f"signup:{_client_key(request)}", c.settings.login_rate_limit_per_minute)
    ctx, token = await AuthService(db, c.settings).signup(payload)
    _set_cookie(response, c.settings, token)
    return session_out(ctx)


@router.post("/login", response_model=SessionOut)
async def login(payload: LoginRequest, request: Request, response: Response, db: DbDep, c: ContainerDep) -> SessionOut:
    c.rate_limiter.hit(f"login:{_client_key(request)}", c.settings.login_rate_limit_per_minute)
    c.rate_limiter.hit(f"login:{payload.email}", c.settings.login_rate_limit_per_minute)
    ctx, token = await AuthService(db, c.settings).login(payload)
    _set_cookie(response, c.settings, token)
    return session_out(ctx)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: DbDep, c: ContainerDep) -> Response:
    token = request.cookies.get(c.settings.session_cookie_name)
    if token:
        await AuthService(db, c.settings).logout(token)
    response.delete_cookie(c.settings.session_cookie_name, path="/")
    response.status_code = 204
    return response


@router.get("/session", response_model=SessionOut)
async def current_session(ctx: ContextDep) -> SessionOut:
    return session_out(ctx)
