from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.content.options import EmojiStyle, Tone
from app.schemas.common import APIModel, TagList


class BrandFields(APIModel):
    industry: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=2000)
    products_services: str = Field(default="", max_length=2000)
    target_audience: str = Field(default="", max_length=1000)
    location: str = Field(default="", max_length=160)
    tone_of_voice: Tone = Tone.CONVERSATIONAL
    personality: str = Field(default="", max_length=1000)
    content_pillars: TagList = Field(default_factory=list)
    writing_preferences: str = Field(default="", max_length=2000)
    preferred_terminology: TagList = Field(default_factory=list)
    cta_style: str = Field(default="", max_length=200)
    prohibited_words: TagList = Field(default_factory=list)
    prohibited_subjects: TagList = Field(default_factory=list)
    brand_values: TagList = Field(default_factory=list)
    default_hashtags: TagList = Field(default_factory=list)
    emoji_style: EmojiStyle = EmojiStyle.LIGHT
    additional_instructions: str = Field(default="", max_length=2000)


class BrandCreate(BrandFields):
    name: str = Field(min_length=1, max_length=120)
    make_active: bool = True


class BrandUpdate(APIModel):
    """Partial update — only provided fields change."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    industry: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    products_services: str | None = Field(default=None, max_length=2000)
    target_audience: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=160)
    tone_of_voice: Tone | None = None
    personality: str | None = Field(default=None, max_length=1000)
    content_pillars: TagList | None = None
    writing_preferences: str | None = Field(default=None, max_length=2000)
    preferred_terminology: TagList | None = None
    cta_style: str | None = Field(default=None, max_length=200)
    prohibited_words: TagList | None = None
    prohibited_subjects: TagList | None = None
    brand_values: TagList | None = None
    default_hashtags: TagList | None = None
    emoji_style: EmojiStyle | None = None
    additional_instructions: str | None = Field(default=None, max_length=2000)


class BrandOut(BrandFields):
    id: uuid.UUID
    name: str
    is_active: bool = False
    created_at: datetime
    updated_at: datetime
