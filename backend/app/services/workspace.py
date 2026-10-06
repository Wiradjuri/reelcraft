"""Workspace settings, onboarding and session payloads."""

from __future__ import annotations

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationFailed
from app.db.base import utcnow
from app.schemas.account import (
    OnboardingComplete,
    SessionOut,
    UserOut,
    WorkspaceOut,
    WorkspacePreferences,
    WorkspaceUpdate,
)
from app.services.brands import BrandService
from app.services.context import RequestContext


def preferences_of(raw: dict[str, object] | None) -> WorkspacePreferences:
    try:
        return WorkspacePreferences.model_validate(raw or {})
    except ValidationError:
        return WorkspacePreferences()


def workspace_out(ctx: RequestContext) -> WorkspaceOut:
    ws = ctx.workspace
    return WorkspaceOut(
        id=ws.id,
        name=ws.name,
        plan=ws.plan,
        role=ctx.role,
        active_brand_id=ws.active_brand_id,
        onboarding_completed=ws.onboarding_completed_at is not None,
        ai_source="custom" if ws.ai_source == "custom" else "platform",
        preferences=preferences_of(ws.preferences),
    )


def session_out(ctx: RequestContext) -> SessionOut:
    return SessionOut(user=UserOut.model_validate(ctx.user), workspace=workspace_out(ctx))


class WorkspaceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def update(self, ctx: RequestContext, payload: WorkspaceUpdate) -> WorkspaceOut:
        changes = payload.model_dump(exclude_unset=True)
        if "name" in changes or "preferences" in changes:
            ctx.require("admin")
        if payload.name:
            ctx.workspace.name = payload.name
        if payload.preferences is not None:
            ctx.workspace.preferences = payload.preferences.model_dump(mode="json")
        if payload.active_brand_id is not None:
            await BrandService(self.db).set_active(ctx, payload.active_brand_id)
        await self.db.commit()
        return workspace_out(ctx)

    async def complete_onboarding(self, ctx: RequestContext, payload: OnboardingComplete) -> WorkspaceOut:
        ctx.require("admin")
        brands = BrandService(self.db)
        if payload.brand is not None:
            await brands.create(ctx, payload.brand)
        if await brands.count(ctx) == 0:
            raise ValidationFailed(
                "Tell us about your business so we can tailor your content.", title="Add your brand to continue"
            )
        if ctx.workspace.onboarding_completed_at is None:
            ctx.workspace.onboarding_completed_at = utcnow()
        await self.db.commit()
        return workspace_out(ctx)
