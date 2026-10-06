"""Migrations build the same schema as the ORM models."""

from __future__ import annotations

from pathlib import Path

from alembic.config import Config

from alembic import command

BACKEND = Path(__file__).resolve().parents[1]


def _config(url: str) -> Config:
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    config.attributes["configure_logger"] = False
    return config


def test_upgrade_downgrade_and_no_model_drift(tmp_path: Path) -> None:
    config = _config(f"sqlite+aiosqlite:///{tmp_path / 'migrations.db'}")
    command.upgrade(config, "head")
    command.check(config)  # raises if models and migrations disagree
    command.downgrade(config, "base")
    command.upgrade(config, "head")
