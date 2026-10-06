"""Database URL handling for hosted PostgreSQL and serverless hosts."""

from __future__ import annotations

from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr, ValidationError
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

from app.core.config import Settings
from app.db.session import asyncpg_connection, create_engine

NEON_URL = "postgresql://app:s3cret@ep-cool-name-123456-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"


def _settings(tmp_path: Path, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "data_dir": tmp_path,
        "secret_encryption_key": SecretStr(Fernet.generate_key().decode()),
        **overrides,
    }
    return Settings(_env_file=None, **values)  # type: ignore[arg-type]


@pytest.mark.parametrize("scheme", ["postgres://", "postgresql://", "postgresql+psycopg2://"])
def test_provider_urls_are_pointed_at_the_async_driver(tmp_path: Path, scheme: str) -> None:
    settings = _settings(tmp_path, database_url=f"{scheme}app:pw@db.example.com/reelcraft")
    assert settings.database_url == "postgresql+asyncpg://app:pw@db.example.com/reelcraft"
    assert not settings.uses_sqlite


def test_libpq_parameters_become_asyncpg_arguments() -> None:
    url, connect_args = asyncpg_connection(make_url(NEON_URL.replace("postgresql://", "postgresql+asyncpg://")))
    assert dict(url.query) == {}
    assert url.password == "s3cret"
    assert connect_args["ssl"] == "require"
    # Neon's pooled host runs PgBouncer in transaction mode: no cached prepared statements.
    assert connect_args["statement_cache_size"] == 0
    assert connect_args["prepared_statement_cache_size"] == 0


def test_direct_connections_keep_prepared_statements() -> None:
    _, connect_args = asyncpg_connection(make_url("postgresql+asyncpg://app:pw@localhost:5432/reelcraft"))
    assert connect_args == {}


def test_serverless_engine_never_holds_connections_open(tmp_path: Path) -> None:
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        vercel=True,
        database_url=NEON_URL,
        data_dir=tmp_path,
        secret_encryption_key=SecretStr(Fernet.generate_key().decode()),
    )
    assert settings.is_production  # hosted deployments default to the production posture
    assert settings.migrate_on_startup
    engine = create_engine(settings)
    assert isinstance(engine.sync_engine.pool, NullPool)
    assert engine.url.drivername == "postgresql+asyncpg"


def test_long_running_servers_keep_a_pool_and_skip_startup_migrations(tmp_path: Path) -> None:
    settings = _settings(tmp_path, database_url="postgresql://app:pw@localhost/reelcraft")
    assert not settings.migrate_on_startup
    assert not isinstance(create_engine(settings).sync_engine.pool, NullPool)


def test_vercel_refuses_the_development_sqlite_file(tmp_path: Path) -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL must point at a PostgreSQL database"):
        _settings(tmp_path, vercel=True)


def test_vercel_requires_a_stable_encryption_key(tmp_path: Path) -> None:
    with pytest.raises(ValidationError, match="SECRET_ENCRYPTION_KEY must be set"):
        _settings(tmp_path, vercel=True, database_url=NEON_URL, secret_encryption_key=None)


def test_choice_settings_ignore_case_and_whitespace(tmp_path: Path) -> None:
    settings = _settings(tmp_path, environment=" Test ", platform_ai_provider="ANTHROPIC")
    assert settings.environment == "test"
    assert settings.platform_ai_provider == "anthropic"
