from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import ContainerDep, ContextDep, DbDep, OptionalContextDep
from app.schemas.account import OnboardingComplete, SetupStatus, WorkspaceOut, WorkspaceUpdate
from app.services.ai_settings import platform_ai_available
from app.services.auth import AuthService
from app.services.library import HistoryService
from app.services.workspace import WorkspaceService, workspace_out

router = APIRouter(tags=["workspace"])


@router.get("/setup/status", response_model=SetupStatus)
async def setup_status(db: DbDep, c: ContainerDep, ctx: OptionalContextDep) -> SetupStatus:
    """Tells the UI whether to show the setup wizard, sign-in or the app."""
    needs_account = await AuthService(db, c.settings).user_count() == 0
    return SetupStatus(
        needs_account=needs_account,
        authenticated=ctx is not None,
        onboarding_completed=bool(ctx and ctx.workspace.onboarding_completed_at),
        signup_allowed=needs_account or c.settings.allow_public_signup,
        platform_ai_available=platform_ai_available(c.settings),
    )


@router.post("/setup/complete", response_model=WorkspaceOut)
async def complete_onboarding(payload: OnboardingComplete, ctx: ContextDep, db: DbDep) -> WorkspaceOut:
    return await WorkspaceService(db).complete_onboarding(ctx, payload)


@router.get("/workspace", response_model=WorkspaceOut)
async def get_workspace(ctx: ContextDep) -> WorkspaceOut:
    return workspace_out(ctx)


@router.patch("/workspace", response_model=WorkspaceOut)
async def update_workspace(payload: WorkspaceUpdate, ctx: ContextDep, db: DbDep) -> WorkspaceOut:
    return await WorkspaceService(db).update(ctx, payload)


@router.get("/workspace/stats")
async def workspace_stats(ctx: ContextDep, db: DbDep) -> dict[str, int]:
    return await HistoryService(db).stats(ctx)
