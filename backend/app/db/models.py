"""Persistence models.

Tenancy: every customer-owned row belongs to a :class:`Workspace`. Users join
workspaces through :class:`WorkspaceMember` (with a role), which is the seam for
teams, agencies with client workspaces, and role-based permissions.

Content model:

* :class:`ContentGeneration` — one generation request (the *generation history*). It
  snapshots the brand profile and settings used, plus provider/model/usage metadata.
* :class:`ContentItem` — one variation produced by a generation. ``data`` holds a typed,
  validated payload (``ReelProject``, ``Caption``, ``Quote``, ``PostIdea`` — see
  ``app.content.schemas``) discriminated by ``content_type``.
* :class:`SavedContent` — a library entry; snapshots the (possibly edited) payload so it
  survives history clean-up.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    last_login_at: Mapped[datetime | None]

    memberships: Mapped[list[WorkspaceMember]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Workspace(IdMixin, TimestampMixin, Base):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(120))
    # Commercial seams: plan/quota enforcement hooks off these.
    plan: Mapped[str] = mapped_column(String(40), default="starter")
    onboarding_completed_at: Mapped[datetime | None]
    active_brand_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("brand_profiles.id", ondelete="SET NULL", use_alter=True), nullable=True
    )
    # "platform" = CGM-hosted AI, "custom" = Bring Your Own AI (see ProviderSettings).
    ai_source: Mapped[str] = mapped_column(String(20), default="platform")
    # Which ProviderSettings connection is used when ai_source == "custom".
    ai_provider: Mapped[str | None] = mapped_column(String(40))
    # Customer preferences (default quality, advanced overrides). Validated by app.schemas.settings.
    preferences: Mapped[dict[str, Any]] = mapped_column(default=dict)

    members: Mapped[list[WorkspaceMember]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(IdMixin, TimestampMixin, Base):
    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20), default="owner")  # owner | admin | editor | viewer

    workspace: Mapped[Workspace] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class AuthSession(IdMixin, TimestampMixin, Base):
    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]


class BrandProfile(IdMixin, TimestampMixin, Base):
    __tablename__ = "brand_profiles"

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    industry: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    products_services: Mapped[str] = mapped_column(Text, default="")
    target_audience: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(160), default="")
    tone_of_voice: Mapped[str] = mapped_column(String(40), default="conversational")
    personality: Mapped[str] = mapped_column(Text, default="")
    content_pillars: Mapped[list[str]] = mapped_column(default=list)
    writing_preferences: Mapped[str] = mapped_column(Text, default="")
    preferred_terminology: Mapped[list[str]] = mapped_column(default=list)
    cta_style: Mapped[str] = mapped_column(String(200), default="")
    prohibited_words: Mapped[list[str]] = mapped_column(default=list)
    prohibited_subjects: Mapped[list[str]] = mapped_column(default=list)
    brand_values: Mapped[list[str]] = mapped_column(default=list)
    default_hashtags: Mapped[list[str]] = mapped_column(default=list)
    emoji_style: Mapped[str] = mapped_column(String(20), default="light")  # none | light | expressive
    additional_instructions: Mapped[str] = mapped_column(Text, default="")
    archived_at: Mapped[datetime | None]


class ContentGeneration(IdMixin, TimestampMixin, Base):
    """A single generation request and its outcome (generation history)."""

    __tablename__ = "content_generations"
    __table_args__ = (Index("ix_content_generations_ws_created", "workspace_id", "created_at"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    brand_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("brand_profiles.id", ondelete="SET NULL"), index=True, nullable=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    platform: Mapped[str] = mapped_column(String(30), default="instagram")
    content_type: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    request: Mapped[dict[str, Any]] = mapped_column(default=dict)
    brand_snapshot: Mapped[dict[str, Any]] = mapped_column(default=dict)
    status: Mapped[str] = mapped_column(String(20), default="succeeded")  # succeeded | failed
    error_code: Mapped[str | None] = mapped_column(String(60))
    # Routing / provider metadata (shown only under "Advanced details").
    quality_requested: Mapped[str] = mapped_column(String(20), default="auto")
    quality_resolved: Mapped[str | None] = mapped_column(String(20))
    ai_source: Mapped[str | None] = mapped_column(String(20))
    provider: Mapped[str | None] = mapped_column(String(40))
    model: Mapped[str | None] = mapped_column(String(120))
    prompt_version: Mapped[str | None] = mapped_column(String(20))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)

    items: Mapped[list[ContentItem]] = relationship(
        back_populates="generation", cascade="all, delete-orphan", order_by="ContentItem.position"
    )


class ContentItem(IdMixin, TimestampMixin, Base):
    """One variation (ReelProject / Caption / Quote / PostIdea) produced by a generation."""

    __tablename__ = "content_items"

    generation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("content_generations.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    content_type: Mapped[str] = mapped_column(String(30))
    position: Mapped[int] = mapped_column(Integer, default=0)
    angle: Mapped[str] = mapped_column(String(60), default="")
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    is_edited: Mapped[bool] = mapped_column(default=False)

    generation: Mapped[ContentGeneration] = relationship(back_populates="items")


class SavedContent(IdMixin, TimestampMixin, Base):
    __tablename__ = "saved_content"
    __table_args__ = (Index("ix_saved_content_ws_created", "workspace_id", "created_at"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    brand_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("brand_profiles.id", ondelete="SET NULL"), index=True, nullable=True
    )
    item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("content_items.id", ondelete="SET NULL"))
    generation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("content_generations.id", ondelete="SET NULL"))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    platform: Mapped[str] = mapped_column(String(30), default="instagram")
    content_type: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(200))
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
    # Context that explains how this was made (objective, tone, angle, topic…).
    generation_context: Mapped[dict[str, Any]] = mapped_column(default=dict)
    tags: Mapped[list[str]] = mapped_column(default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_favourite: Mapped[bool] = mapped_column(default=False, index=True)
    # Future: approval workflow / scheduling seams.
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | approved | scheduled | published


class ProviderSettings(IdMixin, TimestampMixin, Base):
    """A workspace's Bring-Your-Own-AI connection. API keys are encrypted at rest."""

    __tablename__ = "provider_settings"
    __table_args__ = (UniqueConstraint("workspace_id", "provider"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(40))
    encrypted_api_key: Mapped[str | None] = mapped_column(Text)
    key_hint: Mapped[str | None] = mapped_column(String(20))
    base_url: Mapped[str | None] = mapped_column(String(500))
    # Optional per-tier model choices: {"fast": "...", "professional": "...", "premium": "..."}
    tier_models: Mapped[dict[str, Any]] = mapped_column(default=dict)
    last_test_ok: Mapped[bool | None]
    last_test_message: Mapped[str | None] = mapped_column(String(300))
    last_tested_at: Mapped[datetime | None]


class UsageEvent(IdMixin, TimestampMixin, Base):
    """AI usage metering — the basis for quotas, billing and analytics."""

    __tablename__ = "usage_events"
    __table_args__ = (Index("ix_usage_events_ws_created", "workspace_id", "created_at"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    generation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("content_generations.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(30))  # generate | regenerate_field
    ai_source: Mapped[str] = mapped_column(String(20))
    provider: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(120))
    tier: Mapped[str] = mapped_column(String(20))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    succeeded: Mapped[bool] = mapped_column(default=True)
