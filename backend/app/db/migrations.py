"""Run Alembic migrations from application code.

Serverless hosts have no release step to run ``alembic upgrade head`` from, so the API
applies pending migrations itself when it boots (see ``Settings.migrate_on_startup``).
"""

from __future__ import annotations

import asyncio

from alembic.config import Config

from alembic import command
from app.core.config import BACKEND_ROOT, Settings
from app.core.logging import get_logger

log = get_logger(__name__)


def alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    config.attributes["configure_logger"] = False
    return config


def upgrade_to_head(database_url: str) -> None:
    """Apply every pending migration. Safe to call concurrently and when already up to date."""
    command.upgrade(alembic_config(database_url), "head")


async def run_startup_migrations(settings: Settings) -> None:
    if not (BACKEND_ROOT / "alembic" / "env.py").exists():
        raise RuntimeError("Database migrations are missing from this deployment (expected an 'alembic' directory).")
    # Alembic drives its own event loop, so it runs in a worker thread.
    await asyncio.to_thread(upgrade_to_head, settings.database_url)
    log.info("db.migrated")
