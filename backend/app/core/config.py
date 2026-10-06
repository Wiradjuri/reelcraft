"""Application configuration.

Configuration is read from environment variables (and an optional ``.env`` file in
development). This is the *operator/developer* configuration surface only — end
customers configure everything they need through the application UI, and those
choices are persisted in the database.
"""

from __future__ import annotations

import json
import secrets
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]

Environment = Literal["development", "test", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_ROOT.parent / ".env", BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Runtime -----------------------------------------------------------------
    environment: Environment = "development"
    app_name: str = "ReelCraft"
    log_level: str = "INFO"
    log_json: bool = Field(default=False, description="Emit JSON logs (recommended in production).")

    # --- HTTP --------------------------------------------------------------------
    api_prefix: str = "/api/v1"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    max_request_bytes: int = 256 * 1024
    # Built frontend served by the API process (single-origin deployments). Ignored if missing.
    frontend_dist_dir: Path | None = BACKEND_ROOT.parent / "frontend" / "dist"
    trusted_hosts: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["*"])

    # --- Persistence -------------------------------------------------------------
    database_url: str = f"sqlite+aiosqlite:///{BACKEND_ROOT / 'data' / 'reelcraft.db'}"
    database_echo: bool = False
    data_dir: Path = BACKEND_ROOT / "data"

    # --- Security ----------------------------------------------------------------
    # Key used to encrypt customer-supplied AI credentials at rest (Fernet, url-safe base64, 32 bytes).
    # In development a key is generated and stored in ``data_dir`` automatically.
    secret_encryption_key: SecretStr | None = None
    session_cookie_name: str = "rc_session"
    session_ttl_hours: int = 24 * 14
    cookie_secure: bool | None = None  # defaults to True in production
    allow_public_signup: bool = True
    login_rate_limit_per_minute: int = 10
    generation_rate_limit_per_minute: int = 20

    # --- Platform AI (CGM-hosted credentials, never exposed to browsers) ---------
    platform_ai_provider: Literal["openai", "anthropic", "gemini", "openrouter", "none"] = "openai"
    openai_api_key: SecretStr | None = None
    anthropic_api_key: SecretStr | None = None
    gemini_api_key: SecretStr | None = None
    openrouter_api_key: SecretStr | None = None
    ai_request_timeout_seconds: float = 120.0
    # Allow customer-supplied AI server URLs on private/local networks (LM Studio, Ollama).
    # Defaults to allowed outside production; keep disabled for multi-tenant hosting.
    allow_private_ai_urls: bool | None = None
    ai_model_catalog_path: Path | None = Field(
        default=None, description="Optional override for the model catalogue TOML file."
    )

    @field_validator("cors_origins", "trusted_hosts", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """Accept either a JSON list or a comma-separated string."""
        if isinstance(value, str):
            if value.strip().startswith("["):
                return json.loads(value)
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def _production_guards(self) -> Settings:
        if self.environment == "production":
            if self.secret_encryption_key is None:
                raise ValueError("SECRET_ENCRYPTION_KEY must be set in production.")
            if any(origin == "*" for origin in self.cors_origins):
                raise ValueError("Wildcard CORS origins are not allowed in production.")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def secure_cookies(self) -> bool:
        return self.cookie_secure if self.cookie_secure is not None else self.is_production

    @property
    def private_ai_urls_allowed(self) -> bool:
        return self.allow_private_ai_urls if self.allow_private_ai_urls is not None else not self.is_production

    def resolve_encryption_key(self) -> bytes:
        """Return the Fernet key, generating a local development key when needed."""
        if self.secret_encryption_key is not None:
            return self.secret_encryption_key.get_secret_value().encode()
        from cryptography.fernet import Fernet

        self.data_dir.mkdir(parents=True, exist_ok=True)
        key_file = self.data_dir / ".encryption_key"
        if not key_file.exists():
            key_file.write_bytes(Fernet.generate_key())
            key_file.chmod(0o600)
        return key_file.read_bytes().strip()

    def platform_api_key(self, provider: str) -> str | None:
        secret = {
            "openai": self.openai_api_key,
            "anthropic": self.anthropic_api_key,
            "gemini": self.gemini_api_key,
            "openrouter": self.openrouter_api_key,
        }.get(provider)
        return secret.get_secret_value() if secret else None


@lru_cache
def get_settings() -> Settings:
    return Settings()


def new_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)
