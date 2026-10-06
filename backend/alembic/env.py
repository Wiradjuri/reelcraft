"""Alembic migration environment (async, settings-driven)."""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from sqlalchemy.engine import Connection

from alembic import context
from app.core.config import get_settings
from app.db import models  # noqa: F401  (register models)
from app.db.base import Base
from app.db.session import create_engine

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

settings = get_settings()
if not config.get_main_option("sqlalchemy.url"):
    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

# Arbitrary constant: serialises concurrent upgrades (e.g. several serverless instances booting at once).
MIGRATION_LOCK_ID = 7226001

target_metadata = Base.metadata


def _configure(connection: Connection | None = None, **kwargs: object) -> None:
    url = config.get_main_option("sqlalchemy.url") or ""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=url.startswith("sqlite"),  # SQLite needs batch mode for ALTERs
        compare_type=True,
        **kwargs,  # type: ignore[arg-type]
    )


def run_migrations_offline() -> None:
    _configure(url=config.get_main_option("sqlalchemy.url"), literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    _configure(connection)
    with context.begin_transaction():
        if connection.dialect.name == "postgresql":
            connection.exec_driver_sql(f"SELECT pg_advisory_xact_lock({MIGRATION_LOCK_ID})")
        context.run_migrations()


async def run_async_migrations() -> None:
    # Same connection handling as the app (TLS, pooler quirks); one short-lived connection, no pool.
    connectable = create_engine(settings, url=config.get_main_option("sqlalchemy.url"), serverless=True, echo=False)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
