from __future__ import annotations

from fastapi import APIRouter, Response

from app.ai.types import ProviderName
from app.api.deps import AISettingsDep, ContainerDep, ContextDep
from app.schemas.account import (
    AISettingsOut,
    AISourceUpdate,
    ProviderConnectionIn,
    ProviderConnectionOut,
    TestConnectionResult,
)

router = APIRouter(prefix="/settings/ai", tags=["settings"])


@router.get("", response_model=AISettingsOut)
async def ai_settings(ctx: ContextDep, service: AISettingsDep) -> AISettingsOut:
    return await service.overview(ctx)


@router.put("/source", response_model=AISettingsOut)
async def set_ai_source(payload: AISourceUpdate, ctx: ContextDep, service: AISettingsDep) -> AISettingsOut:
    return await service.set_source(ctx, payload)


@router.put("/connections", response_model=ProviderConnectionOut)
async def save_connection(
    payload: ProviderConnectionIn, ctx: ContextDep, service: AISettingsDep
) -> ProviderConnectionOut:
    return await service.save_connection(ctx, payload)


@router.delete("/connections/{provider}", status_code=204)
async def delete_connection(provider: ProviderName, ctx: ContextDep, service: AISettingsDep) -> Response:
    await service.delete_connection(ctx, provider)
    return Response(status_code=204)


@router.post("/test", response_model=TestConnectionResult)
async def test_connection(
    payload: ProviderConnectionIn, ctx: ContextDep, service: AISettingsDep, c: ContainerDep
) -> TestConnectionResult:
    c.rate_limiter.hit(f"ai-test:{ctx.workspace.id}", 10)
    return await service.test_connection(ctx, payload)
