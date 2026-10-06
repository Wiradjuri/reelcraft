from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DbDep
from app.core.errors import AppError

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
async def ready(db: DbDep) -> dict[str, str]:
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        raise AppError(
            "The database isn't reachable.", title="Service unavailable", code="db_unavailable", status_code=503
        ) from exc
    return {"status": "ready"}
