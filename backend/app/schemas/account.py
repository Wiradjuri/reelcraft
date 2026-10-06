from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from app.ai.types import ProviderName, Tier
from app.content.options import Quality
from app.schemas.brands import BrandCreate
from app.schemas.common import APIModel

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class _Credentials(APIModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = value.strip().lower()
        if not _EMAIL.match(value):
            raise ValueError("Enter a valid email address.")
        return value


class LoginRequest(_Credentials):
    pass


class SignupRequest(_Credentials):
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=200)
    workspace_name: str = Field(min_length=1, max_length=120)

    @field_validator("password")
    @classmethod
    def _strength(cls, value: str) -> str:
        if value.isdigit() or value.isalpha() or len(set(value)) < 5:
            raise ValueError("Use a mix of letters and numbers or symbols.")
        return value


class UserOut(APIModel):
    id: uuid.UUID
    email: str
    name: str


class WorkspacePreferences(APIModel):
    default_quality: Quality = Quality.AUTO


class WorkspaceOut(APIModel):
    id: uuid.UUID
    name: str
    plan: str
    role: str
    active_brand_id: uuid.UUID | None
    onboarding_completed: bool
    ai_source: Literal["platform", "custom"]
    preferences: WorkspacePreferences


class WorkspaceUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    preferences: WorkspacePreferences | None = None
    active_brand_id: uuid.UUID | None = None


class SessionOut(APIModel):
    user: UserOut
    workspace: WorkspaceOut


class SetupStatus(APIModel):
    """Drives first-launch routing in the UI."""

    needs_account: bool
    authenticated: bool
    onboarding_completed: bool
    signup_allowed: bool
    platform_ai_available: bool


class OnboardingComplete(APIModel):
    brand: BrandCreate | None = None


# --- AI & Integrations -----------------------------------------------------------


class AISourceUpdate(APIModel):
    ai_source: Literal["platform", "custom"]
    provider: ProviderName | None = None


class ProviderConnectionIn(APIModel):
    provider: ProviderName
    api_key: str | None = Field(default=None, max_length=500, description="Omit to keep the stored key.")
    base_url: str | None = Field(default=None, max_length=500)
    tier_models: dict[Tier, str] = Field(default_factory=dict)

    @field_validator("tier_models")
    @classmethod
    def _models(cls, value: dict[Tier, str]) -> dict[Tier, str]:
        return {tier: model.strip()[:120] for tier, model in value.items() if model and model.strip()}


class ProviderConnectionOut(APIModel):
    provider: ProviderName
    has_api_key: bool
    key_hint: str | None
    base_url: str | None
    tier_models: dict[str, str]
    last_test_ok: bool | None
    last_test_message: str | None
    last_tested_at: datetime | None


class AISettingsOut(APIModel):
    ai_source: Literal["platform", "custom"]
    active_provider: ProviderName | None
    platform_ai_available: bool
    connections: list[ProviderConnectionOut]


class TestConnectionResult(APIModel):
    ok: bool
    title: str
    message: str
    models: list[dict[str, str]] = Field(default_factory=list)
    details: dict[str, object] = Field(default_factory=dict)
