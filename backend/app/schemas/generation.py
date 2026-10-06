from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.content.requests import GenerationSpec
from app.schemas.common import APIModel


class GenerateRequest(GenerationSpec):
    brand_id: uuid.UUID | None = Field(default=None, description="Defaults to the workspace's active brand.")


class RegenerateFieldRequest(APIModel):
    field: str = Field(min_length=1, max_length=60)
    instruction: str = Field(default="", max_length=500)


class ItemUpdate(APIModel):
    data: dict[str, Any]


class ContentItemOut(APIModel):
    id: uuid.UUID
    generation_id: uuid.UUID
    content_type: str
    position: int
    angle: str
    data: dict[str, Any]
    is_edited: bool
    saved_id: uuid.UUID | None = None
    updated_at: datetime


class GenerationMeta(APIModel):
    """Technical details — shown only under "Advanced details" in the UI."""

    quality_resolved: str | None
    ai_source: str | None
    provider: str | None
    model: str | None
    prompt_version: str | None
    input_tokens: int
    output_tokens: int
    latency_ms: int


class GenerationSummary(APIModel):
    id: uuid.UUID
    brand_id: uuid.UUID | None
    brand_name: str
    platform: str
    content_type: str
    title: str
    topic: str
    objective: str
    quality_requested: str
    status: str
    item_count: int
    created_at: datetime


class GenerationOut(GenerationSummary):
    request: dict[str, Any]
    items: list[ContentItemOut]
    meta: GenerationMeta
