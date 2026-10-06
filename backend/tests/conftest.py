from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI
from pydantic import SecretStr

from app.ai.catalog import get_catalog
from app.ai.router import AIRouter
from app.core.config import Settings
from app.db.base import Base
from app.main import create_app
from tests.fakes import FakeProviderFactory

BRAND = {
    "name": "Bloom & Brew",
    "industry": "Specialty cafe",
    "description": "Neighbourhood cafe roasting single-origin coffee",
    "target_audience": "Young professionals",
    "location": "Melbourne, Australia",
    "tone_of_voice": "playful",
    "content_pillars": ["coffee craft", "community"],
    "prohibited_words": ["cheap"],
}


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        environment="test",
        # Set TEST_DATABASE_URL (e.g. a disposable PostgreSQL database) to run against production's engine.
        database_url=os.environ.get("TEST_DATABASE_URL") or f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        data_dir=tmp_path,
        secret_encryption_key=SecretStr(Fernet.generate_key().decode()),
        openai_api_key=SecretStr("sk-platform-test-key-1234567890"),
        platform_ai_provider="openai",
        frontend_dist_dir=None,
        generation_rate_limit_per_minute=1000,
        login_rate_limit_per_minute=1000,
    )


@pytest.fixture
def provider_factory() -> FakeProviderFactory:
    return FakeProviderFactory()


@pytest.fixture
def app(settings: Settings, provider_factory: FakeProviderFactory) -> FastAPI:
    return create_app(settings, AIRouter(get_catalog(), provider_factory=provider_factory))


class APIClient(httpx.AsyncClient):
    """httpx client that sends the CSRF header like the real frontend."""

    async def request(self, method: str, url: Any, **kwargs: Any) -> httpx.Response:  # type: ignore[override]
        headers = dict(kwargs.pop("headers", None) or {})
        headers.setdefault("X-Requested-With", "reelcraft")
        return await super().request(method, url, headers=headers, **kwargs)


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[APIClient]:
    async with app.router.lifespan_context(app):
        engine = app.state.container.database.engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        transport = httpx.ASGITransport(app=app)
        async with APIClient(transport=transport, base_url="http://test/api/v1") as c:
            yield c


async def signup(
    client: httpx.AsyncClient, email: str = "owner@example.com", workspace: str = "Bloom"
) -> dict[str, Any]:
    response = await client.post(
        "/auth/signup",
        json={"email": email, "password": "Sup3r-secret!", "name": "Alex", "workspace_name": workspace},
    )
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


async def onboard(client: httpx.AsyncClient, email: str = "owner@example.com") -> dict[str, Any]:
    await signup(client, email)
    response = await client.post("/setup/complete", json={"brand": BRAND})
    assert response.status_code == 200, response.text
    return response.json()  # type: ignore[no-any-return]
