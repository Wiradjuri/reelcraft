"""FastAPI dependencies: database sessions, authentication and service wiring."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.router import AIRouter
from app.core.config import Settings
from app.core.errors import AuthenticationRequired
from app.core.rate_limit import RateLimiter
from app.core.security import SecretBox
from app.db.session import Database
from app.services.ai_settings import AISettingsService
from app.services.auth import AuthService
from app.services.context import RequestContext
from app.services.generation import ContentGenerationService


@dataclass
class Container:
    """Process-wide singletons, created at startup and stored on ``app.state``."""

    settings: Settings
    database: Database
    router: AIRouter
    secret_box: SecretBox
    rate_limiter: RateLimiter


def get_container(request: Request) -> Container:
    return request.app.state.container  # type: ignore[no-any-return]


ContainerDep = Annotated[Container, Depends(get_container)]


async def get_db(container: ContainerDep) -> AsyncIterator[AsyncSession]:
    async with container.database.sessionmaker() as session:
        yield session


DbDep = Annotated[AsyncSession, Depends(get_db)]


async def get_context(request: Request, db: DbDep, container: ContainerDep) -> RequestContext:
    token = request.cookies.get(container.settings.session_cookie_name)
    return await AuthService(db, container.settings).context_for_token(token)


async def get_optional_context(request: Request, db: DbDep, container: ContainerDep) -> RequestContext | None:
    try:
        return await get_context(request, db, container)
    except AuthenticationRequired:
        return None


ContextDep = Annotated[RequestContext, Depends(get_context)]
OptionalContextDep = Annotated[RequestContext | None, Depends(get_optional_context)]


def get_ai_settings_service(db: DbDep, container: ContainerDep) -> AISettingsService:
    return AISettingsService(db, container.settings, container.secret_box)


AISettingsDep = Annotated[AISettingsService, Depends(get_ai_settings_service)]


def get_generation_service(db: DbDep, container: ContainerDep, ai: AISettingsDep) -> ContentGenerationService:
    return ContentGenerationService(db, container.router, ai)


GenerationDep = Annotated[ContentGenerationService, Depends(get_generation_service)]
