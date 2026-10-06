"""Migrations build the same schema as the ORM models."""

from __future__ import annotations

import asyncio

import httpx
from sqlalchemy import text

from alembic import command
from app.core.config import Settings
from app.db.migrations import alembic_config
from app.db.session import create_engine
from app.main import create_app


async def _drop_everything(settings: Settings) -> None:
    """Empty the database (a no-op for SQLite, where every test gets a fresh file).

    Set TEST_DATABASE_URL to a disposable PostgreSQL database to exercise production's engine.
    """
    if settings.uses_sqlite:
        return
    engine = create_engine(settings, serverless=True)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await engine.dispose()


async def test_app_migrates_an_empty_database_on_startup(settings: Settings) -> None:
    """Serverless deployments have no release step, so the API builds its own schema."""
    settings.run_migrations_on_startup = True
    await _drop_everything(settings)
    app = create_app(settings)
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client,
    ):
        response = await client.get("/setup/status")
        assert response.status_code == 200, response.text
        assert response.json()["needs_account"] is True
    # A second boot (another instance, a cold start) finds nothing left to do.
    async with app.router.lifespan_context(app):
        pass
    await _drop_everything(settings)


def test_upgrade_downgrade_and_no_model_drift(settings: Settings) -> None:
    asyncio.run(_drop_everything(settings))
    config = alembic_config(settings.database_url)
    command.upgrade(config, "head")
    command.check(config)  # raises if models and migrations disagree
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    asyncio.run(_drop_everything(settings))
