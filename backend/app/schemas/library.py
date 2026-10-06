from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.common import APIModel, TagList


class SaveItemRequest(APIModel):
    item_id: uuid.UUID
    title: str | None = Field(default=None, max_length=200)
    tags: TagList = Field(default_factory=list)
    is_favourite: bool = False


class SavedUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    tags: TagList | None = None
    notes: str | None = Field(default=None, max_length=2000)
    is_favourite: bool | None = None
    data: dict[str, Any] | None = None


class SavedOut(APIModel):
    id: uuid.UUID
    brand_id: uuid.UUID | None
    brand_name: str = ""
    item_id: uuid.UUID | None
    generation_id: uuid.UUID | None
    platform: str
    content_type: str
    title: str
    data: dict[str, Any]
    generation_context: dict[str, Any]
    tags: list[str]
    notes: str
    is_favourite: bool
    status: str
    created_at: datetime
    updated_at: datetime
