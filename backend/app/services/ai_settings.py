"""AI source resolution and Bring-Your-Own-AI connection management.

Credentials never leave the server: keys are encrypted at rest with
:class:`~app.core.security.SecretBox` and API responses only ever include a masked hint.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.errors import AIError, AINotConfigured
from app.ai.providers.registry import PROVIDER_INFO, create_provider
from app.ai.router import AIConnection
from app.ai.types import ProviderConfig, ProviderName, Tier
from app.ai.url_safety import validate_base_url
from app.core.config import Settings
from app.core.errors import NotFoundError, ValidationFailed
from app.core.logging import get_logger
from app.core.security import SecretBox, mask_secret
from app.db.base import utcnow
from app.db.models import ProviderSettings
from app.schemas.account import (
    AISettingsOut,
    AISourceUpdate,
    ProviderConnectionIn,
    ProviderConnectionOut,
    TestConnectionResult,
)
from app.services.context import RequestContext

log = get_logger(__name__)


def platform_ai_available(settings: Settings) -> bool:
    provider = settings.platform_ai_provider
    return provider != "none" and bool(settings.platform_api_key(provider))


class AISettingsService:
    def __init__(self, db: AsyncSession, settings: Settings, box: SecretBox) -> None:
        self.db = db
        self.settings = settings
        self.box = box

    # --- Resolution used by content generation ---------------------------------
    async def resolve_connection(self, ctx: RequestContext) -> AIConnection:
        workspace = ctx.workspace
        if workspace.ai_source == "custom" and workspace.ai_provider:
            row = await self._get(ctx, ProviderName(workspace.ai_provider))
            if row is None:
                raise AINotConfigured()
            config = await self._config_from_row(row)
            return AIConnection(
                source="custom",
                config=config,
                tier_models={Tier(k): v for k, v in (row.tier_models or {}).items() if k in Tier._value2member_map_},
            )
        if not platform_ai_available(self.settings):
            raise AINotConfigured()
        provider = ProviderName(self.settings.platform_ai_provider)
        return AIConnection(
            source="platform",
            config=ProviderConfig(
                provider=provider,
                api_key=self.settings.platform_api_key(provider),
                timeout_seconds=self.settings.ai_request_timeout_seconds,
            ),
        )

    async def _config_from_row(self, row: ProviderSettings) -> ProviderConfig:
        api_key = self.box.decrypt(row.encrypted_api_key) if row.encrypted_api_key else None
        if row.encrypted_api_key and api_key is None:
            log.error("ai.credential_decrypt_failed", provider=row.provider)
            raise AINotConfigured(
                "Your saved AI key can no longer be read. Please enter it again in Settings → AI & Integrations.",
                title="Please re-enter your AI key",
            )
        base_url = row.base_url
        if base_url:
            base_url = await validate_base_url(base_url, allow_private=self.settings.private_ai_urls_allowed)
        return ProviderConfig(
            provider=ProviderName(row.provider),
            api_key=api_key,
            base_url=base_url,
            timeout_seconds=self.settings.ai_request_timeout_seconds,
        )

    # --- Settings UI ------------------------------------------------------------
    async def overview(self, ctx: RequestContext) -> AISettingsOut:
        rows = await self.db.scalars(select(ProviderSettings).where(ProviderSettings.workspace_id == ctx.workspace.id))
        return AISettingsOut(
            ai_source="custom" if ctx.workspace.ai_source == "custom" else "platform",
            active_provider=ProviderName(ctx.workspace.ai_provider) if ctx.workspace.ai_provider else None,
            platform_ai_available=platform_ai_available(self.settings),
            connections=[self._out(row) for row in rows],
        )

    async def save_connection(self, ctx: RequestContext, payload: ProviderConnectionIn) -> ProviderConnectionOut:
        ctx.require("admin")
        row = await self._get(ctx, payload.provider)
        if row is None:
            row = ProviderSettings(workspace_id=ctx.workspace.id, provider=payload.provider.value)
            self.db.add(row)
        config = await self._candidate_config(ctx, payload, row)
        if payload.api_key:
            row.encrypted_api_key = self.box.encrypt(payload.api_key.strip())
            row.key_hint = mask_secret(payload.api_key.strip())
        row.base_url = config.base_url
        row.tier_models = {tier.value: model for tier, model in payload.tier_models.items()}
        await self.db.commit()
        log.info("ai.connection_saved", workspace_id=str(ctx.workspace.id), provider=payload.provider)
        return self._out(row)

    async def delete_connection(self, ctx: RequestContext, provider: ProviderName) -> None:
        ctx.require("admin")
        row = await self._get(ctx, provider)
        if row is None:
            raise NotFoundError()
        await self.db.delete(row)
        if ctx.workspace.ai_provider == provider.value:
            ctx.workspace.ai_source = "platform"
            ctx.workspace.ai_provider = None
        await self.db.commit()

    async def set_source(self, ctx: RequestContext, payload: AISourceUpdate) -> AISettingsOut:
        ctx.require("admin")
        if payload.ai_source == "custom":
            if payload.provider is None or await self._get(ctx, payload.provider) is None:
                raise ValidationFailed(
                    "Connect and save a provider before switching to it.", title="Connect a provider first"
                )
            ctx.workspace.ai_source = "custom"
            ctx.workspace.ai_provider = payload.provider.value
        else:
            ctx.workspace.ai_source = "platform"
        await self.db.commit()
        return await self.overview(ctx)

    async def test_connection(self, ctx: RequestContext, payload: ProviderConnectionIn) -> TestConnectionResult:
        """Check credentials by listing models (and, for chosen models, that they exist)."""
        ctx.require("admin")
        row = await self._get(ctx, payload.provider)
        config = await self._candidate_config(ctx, payload, row)
        info = PROVIDER_INFO[payload.provider]
        if info.requires_api_key and not config.api_key:
            return TestConnectionResult(
                ok=False, title="Add your API key", message="Paste your API key, then test again."
            )
        provider = create_provider(config)
        try:
            models = await provider.list_models()
        except AIError as exc:
            ok, title, message, details = False, exc.title, exc.message, exc.details
            models = []
        else:
            ok, title, details = True, "Connected successfully", {}
            message = f"{info.label} is ready to use." + (f" {len(models)} models available." if models else "")
            known = {m.id for m in models}
            missing = [m for m in payload.tier_models.values() if known and m not in known]
            if missing:
                ok, title = False, "Connected, but a model wasn't found"
                message = f"Your key works, but these models aren't available: {', '.join(missing)}."
        finally:
            await provider.close()
        if row is not None:
            row.last_test_ok, row.last_test_message, row.last_tested_at = ok, message[:300], utcnow()
            await self.db.commit()
        log.info("ai.connection_tested", provider=payload.provider, ok=ok)
        return TestConnectionResult(
            ok=ok,
            title=title,
            message=message,
            models=[{"id": m.id, "label": m.label or m.id} for m in models[:500]],
            details=details,
        )

    # --- helpers ----------------------------------------------------------------
    async def _candidate_config(
        self, ctx: RequestContext, payload: ProviderConnectionIn, row: ProviderSettings | None
    ) -> ProviderConfig:
        """Config from submitted values, falling back to the stored key when none was typed."""
        info = PROVIDER_INFO[payload.provider]
        api_key = (payload.api_key or "").strip() or None
        if api_key is None and row is not None and row.encrypted_api_key:
            api_key = self.box.decrypt(row.encrypted_api_key)
        base_url = (payload.base_url or "").strip() or None
        if info.requires_base_url and not base_url:
            raise ValidationFailed(
                "Enter your server address, for example http://localhost:1234/v1.",
                title="Server address required",
                details={"field": "base_url"},
            )
        if base_url:
            base_url = await validate_base_url(base_url, allow_private=self.settings.private_ai_urls_allowed)
        return ProviderConfig(
            provider=payload.provider,
            api_key=api_key,
            base_url=base_url,
            timeout_seconds=min(self.settings.ai_request_timeout_seconds, 30.0),
        )

    async def _get(self, ctx: RequestContext, provider: ProviderName) -> ProviderSettings | None:
        return await self.db.scalar(
            select(ProviderSettings).where(
                ProviderSettings.workspace_id == ctx.workspace.id, ProviderSettings.provider == provider.value
            )
        )

    @staticmethod
    def _out(row: ProviderSettings) -> ProviderConnectionOut:
        return ProviderConnectionOut(
            provider=ProviderName(row.provider),
            has_api_key=bool(row.encrypted_api_key),
            key_hint=row.key_hint,
            base_url=row.base_url,
            tier_models=dict(row.tier_models or {}),
            last_test_ok=row.last_test_ok,
            last_test_message=row.last_test_message,
            last_tested_at=row.last_tested_at,
        )
