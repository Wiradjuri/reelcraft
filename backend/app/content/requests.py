"""Domain-level inputs to content generation (independent of HTTP and the ORM)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.content.options import (
    REEL_DURATIONS,
    CaptionLength,
    CaptionStyle,
    ContentType,
    EmojiStyle,
    Objective,
    Platform,
    Quality,
    QuoteCategory,
    Tone,
)
from app.content.registry import get_spec


class BrandContext(BaseModel):
    """The parts of a brand profile that shape generated content."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    industry: str = ""
    description: str = ""
    products_services: str = ""
    target_audience: str = ""
    location: str = ""
    tone_of_voice: str = "conversational"
    personality: str = ""
    content_pillars: list[str] = Field(default_factory=list)
    writing_preferences: str = ""
    preferred_terminology: list[str] = Field(default_factory=list)
    cta_style: str = ""
    prohibited_words: list[str] = Field(default_factory=list)
    prohibited_subjects: list[str] = Field(default_factory=list)
    brand_values: list[str] = Field(default_factory=list)
    default_hashtags: list[str] = Field(default_factory=list)
    emoji_style: str = EmojiStyle.LIGHT
    additional_instructions: str = ""


class GenerationOptions(BaseModel):
    """Content-type specific options. Irrelevant options are ignored."""

    model_config = ConfigDict(extra="forbid")

    # Reels
    reel_duration: int = 30
    # Captions
    caption_length: CaptionLength = CaptionLength.MEDIUM
    caption_style: CaptionStyle = CaptionStyle.GENERAL
    # Shared
    emoji_style: EmojiStyle | None = Field(default=None, description="None = use the brand default.")
    include_hashtags: bool = True
    hashtag_count: int = Field(default=6, ge=0, le=30)
    include_cta: bool = True
    cta_preference: str = Field(default="", max_length=200)
    # Quotes
    quote_category: QuoteCategory = QuoteCategory.MOTIVATIONAL

    @model_validator(mode="after")
    def _check(self) -> GenerationOptions:
        if self.reel_duration not in REEL_DURATIONS:
            raise ValueError(f"reel_duration must be one of {REEL_DURATIONS}")
        return self


class GenerationSpec(BaseModel):
    """A fully-specified generation request."""

    platform: Platform = Platform.INSTAGRAM
    content_type: ContentType
    topic: str = Field(min_length=3, max_length=2000)
    objective: Objective = Objective.ENGAGEMENT
    tone: Tone | Literal["brand"] = "brand"
    quality: Quality = Quality.AUTO
    variations: int = Field(default=3, ge=1, le=8)
    options: GenerationOptions = Field(default_factory=GenerationOptions)
    notes: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def _check_variations(self) -> GenerationSpec:
        spec = get_spec(self.content_type)
        if self.variations > spec.max_variations:
            raise ValueError(f"You can create up to {spec.max_variations} variations of this content type at once.")
        return self
