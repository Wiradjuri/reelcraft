"""Accounts, workspaces and sessions."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError, AuthenticationRequired, ConflictError, PermissionDenied
from app.core.logging import get_logger
from app.core.security import hash_password, hash_token, new_session_token, verify_password
from app.db.base import utcnow
from app.db.models import AuthSession, User, Workspace, WorkspaceMember
from app.schemas.account import LoginRequest, SignupRequest
from app.services.context import RequestContext

log = get_logger(__name__)

# Verified against when the email doesn't exist, so response timing doesn't reveal accounts.
_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")


class AuthService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    async def user_count(self) -> int:
        return int(await self.db.scalar(select(func.count()).select_from(User)) or 0)

    async def signup(self, payload: SignupRequest) -> tuple[RequestContext, str]:
        first_user = await self.user_count() == 0
        if not first_user and not self.settings.allow_public_signup:
            raise PermissionDenied("New accounts can only be created by invitation.", title="Sign-ups are closed")
        if await self.db.scalar(select(User.id).where(User.email == payload.email)):
            raise ConflictError(
                "An account with this email already exists. Sign in instead.", title="You already have an account"
            )
        user = User(email=payload.email, name=payload.name.strip(), password_hash=hash_password(payload.password))
        workspace = Workspace(name=payload.workspace_name.strip())
        self.db.add_all([user, workspace])
        await self.db.flush()
        self.db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
        token = await self._new_session(user, workspace)
        await self.db.commit()
        log.info("auth.signup", user_id=str(user.id), workspace_id=str(workspace.id), first_user=first_user)
        return RequestContext(user=user, workspace=workspace, role="owner"), token

    async def login(self, payload: LoginRequest) -> tuple[RequestContext, str]:
        user = await self.db.scalar(select(User).where(User.email == payload.email))
        if user is None:
            verify_password(_DUMMY_HASH, payload.password)
            raise _invalid_credentials()
        if not verify_password(user.password_hash, payload.password) or not user.is_active:
            log.info("auth.login_failed", user_id=str(user.id))
            raise _invalid_credentials()
        membership = await self.db.scalar(
            select(WorkspaceMember).where(WorkspaceMember.user_id == user.id).order_by(WorkspaceMember.created_at)
        )
        if membership is None:
            raise PermissionDenied("Your account isn't part of a workspace yet.")
        workspace = await self.db.get_one(Workspace, membership.workspace_id)
        user.last_login_at = utcnow()
        token = await self._new_session(user, workspace)
        await self.db.commit()
        log.info("auth.login", user_id=str(user.id))
        return RequestContext(user=user, workspace=workspace, role=membership.role), token

    async def logout(self, token: str) -> None:
        session = await self.db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        if session is not None:
            session.revoked_at = utcnow()
            await self.db.commit()

    async def context_for_token(self, token: str | None) -> RequestContext:
        if not token:
            raise AuthenticationRequired()
        session = await self.db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        if session is None or session.revoked_at is not None or session.expires_at <= utcnow():
            raise AuthenticationRequired()
        user = await self.db.get(User, session.user_id)
        membership = await self.db.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.user_id == session.user_id, WorkspaceMember.workspace_id == session.workspace_id
            )
        )
        if user is None or not user.is_active or membership is None:
            raise AuthenticationRequired()
        workspace = await self.db.get_one(Workspace, session.workspace_id)
        return RequestContext(user=user, workspace=workspace, role=membership.role)

    async def _new_session(self, user: User, workspace: Workspace) -> str:
        token = new_session_token()
        self.db.add(
            AuthSession(
                user_id=user.id,
                workspace_id=workspace.id,
                token_hash=hash_token(token),
                expires_at=utcnow() + timedelta(hours=self.settings.session_ttl_hours),
            )
        )
        return token


def _invalid_credentials() -> AppError:
    return AuthenticationRequired(
        "That email and password combination didn't work. Check them and try again.",
        title="We couldn't sign you in",
        code="invalid_credentials",
    )
