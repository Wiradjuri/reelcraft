"""Async engine and session management."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import URL, Engine, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import Settings

# libpq-style URL parameters that hosted Postgres providers append but asyncpg rejects.
_UNSUPPORTED_ASYNCPG_PARAMS = ("channel_binding", "gssencmode", "sslnegotiation", "target_session_attrs")


def _prepared_statement_name() -> str:
    return f"__asyncpg_{uuid.uuid4().hex}__"


def asyncpg_connection(url: URL) -> tuple[URL, dict[str, Any]]:
    """Translate a provider-issued PostgreSQL URL into what asyncpg understands.

    Neon, Vercel Postgres, Supabase and friends hand out libpq URLs such as
    ``...?sslmode=require&channel_binding=require``. asyncpg takes TLS settings as the
    ``ssl`` argument and raises on the rest, so they are moved out of the URL here.
    """
    query = dict(url.query)
    connect_args: dict[str, Any] = {}

    sslmode = query.pop("sslmode", None)
    if sslmode and "ssl" not in query:
        connect_args["ssl"] = sslmode if isinstance(sslmode, str) else sslmode[0]
    timeout = query.pop("connect_timeout", None)
    if timeout:
        connect_args["timeout"] = float(timeout if isinstance(timeout, str) else timeout[0])
    pgbouncer = query.pop("pgbouncer", None)
    for name in _UNSUPPORTED_ASYNCPG_PARAMS:
        query.pop(name, None)

    # Connection poolers in transaction mode (Neon's "-pooler" hosts, PgBouncer) hand each
    # transaction a different server connection, so cached prepared statements must be off.
    behind_pooler = pgbouncer in ("true", "1") or "-pooler." in (url.host or "") or url.port == 6543
    if behind_pooler:
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = _prepared_statement_name

    return url.set(query=query), connect_args


def create_engine(
    settings: Settings, *, url: str | None = None, serverless: bool | None = None, echo: bool | None = None
) -> AsyncEngine:
    """Build the async engine for ``url`` (defaults to the configured database)."""
    parsed = make_url(url or settings.database_url)
    serverless = settings.is_serverless if serverless is None else serverless
    kwargs: dict[str, Any] = {"echo": settings.database_echo if echo is None else echo}

    if parsed.get_backend_name() == "sqlite":
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        kwargs["connect_args"] = {"timeout": 30}
        kwargs["pool_pre_ping"] = True
    elif parsed.get_driver_name() == "asyncpg":
        parsed, kwargs["connect_args"] = asyncpg_connection(parsed)

    if serverless:
        # Instances are frozen between requests and scaled out freely: never hold connections open.
        kwargs["poolclass"] = NullPool
    else:
        kwargs["pool_pre_ping"] = True

    engine = create_async_engine(parsed, **kwargs)
    if parsed.get_backend_name() == "sqlite":
        _enable_sqlite_pragmas(engine.sync_engine)
    return engine


def _enable_sqlite_pragmas(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection, _record):  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


class Database:
    def __init__(self, settings: Settings) -> None:
        self.engine = create_engine(settings)
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def session(self) -> AsyncIterator[AsyncSession]:
        async with self.sessionmaker() as session:
            yield session

    async def dispose(self) -> None:
        await self.engine.dispose()
