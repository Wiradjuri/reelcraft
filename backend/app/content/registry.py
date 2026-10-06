"""Content-type registry: everything the system needs to know about each content type.

Adding a new content type (e.g. "campaign" or "carousel") means adding a payload model
in ``schemas.py`` and an entry here — routing, prompting, validation, regeneration and
the API all derive from this registry.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import cache
from typing import Annotated, Any

from pydantic import BaseModel, Field, create_model

from app.content.options import ContentType
from app.content.schemas import Caption, PostIdea, Quote, ReelProject


@dataclass(frozen=True)
class RegenerableField:
    name: str
    label: str
    guidance: str = ""


@dataclass(frozen=True)
class ContentTypeSpec:
    content_type: ContentType
    payload_model: type[BaseModel]
    title_field: str | None
    # Relative complexity 1 (simple) – 3 (complex); used by the AI router.
    complexity: int
    # Rough output tokens per variation; used for routing and max-token budgeting.
    output_tokens_per_variation: int
    default_variations: int
    max_variations: int
    regenerable_fields: tuple[RegenerableField, ...] = field(default_factory=tuple)

    def field(self, name: str) -> RegenerableField | None:
        return next((f for f in self.regenerable_fields if f.name == name), None)

    def title_for(self, data: dict[str, Any]) -> str:
        if self.title_field and isinstance(data.get(self.title_field), str):
            return str(data[self.title_field])[:200]
        return ""


REGISTRY: dict[ContentType, ContentTypeSpec] = {
    ContentType.REEL: ContentTypeSpec(
        content_type=ContentType.REEL,
        payload_model=ReelProject,
        title_field="title",
        complexity=3,
        output_tokens_per_variation=1400,
        default_variations=3,
        max_variations=4,
        regenerable_fields=(
            RegenerableField("title", "Title"),
            RegenerableField("hook", "Hook", "Make it stop the scroll in the first 1-3 seconds."),
            RegenerableField("concept", "Concept"),
            RegenerableField("opening_shot", "Opening shot"),
            RegenerableField("scenes", "Shots & scenes", "Keep the overall timing consistent with the duration."),
            RegenerableField("script", "Script", "Keep it consistent with the hook and scenes."),
            RegenerableField("voiceover", "Voice-over direction"),
            RegenerableField("on_screen_text", "On-screen text"),
            RegenerableField("audio_suggestion", "Audio"),
            RegenerableField("caption", "Caption"),
            RegenerableField("cta", "Call to action"),
            RegenerableField("hashtags", "Hashtags"),
        ),
    ),
    ContentType.CAPTION: ContentTypeSpec(
        content_type=ContentType.CAPTION,
        payload_model=Caption,
        title_field="hook",
        complexity=1,
        output_tokens_per_variation=350,
        default_variations=3,
        max_variations=5,
        regenerable_fields=(
            RegenerableField("hook", "Opening line"),
            RegenerableField("body", "Caption", "Keep the same opening line as the first line unless told otherwise."),
            RegenerableField("cta", "Call to action"),
            RegenerableField("hashtags", "Hashtags"),
        ),
    ),
    ContentType.QUOTE: ContentTypeSpec(
        content_type=ContentType.QUOTE,
        payload_model=Quote,
        title_field="text",
        complexity=1,
        output_tokens_per_variation=220,
        default_variations=5,
        max_variations=8,
        regenerable_fields=(
            RegenerableField("text", "Quote"),
            RegenerableField("caption", "Caption"),
            RegenerableField("hashtags", "Hashtags"),
            RegenerableField("card", "Quote card", "Keep the card consistent with the quote text."),
        ),
    ),
    ContentType.POST_IDEA: ContentTypeSpec(
        content_type=ContentType.POST_IDEA,
        payload_model=PostIdea,
        title_field="title",
        complexity=2,
        output_tokens_per_variation=600,
        default_variations=3,
        max_variations=5,
        regenerable_fields=(
            RegenerableField("title", "Title"),
            RegenerableField("hook", "Hook"),
            RegenerableField("outline", "Outline"),
            RegenerableField("visual_direction", "Visual direction"),
            RegenerableField("caption", "Caption"),
            RegenerableField("cta", "Call to action"),
            RegenerableField("hashtags", "Hashtags"),
        ),
    ),
}


def get_spec(content_type: ContentType | str) -> ContentTypeSpec:
    return REGISTRY[ContentType(content_type)]


@cache
def variations_envelope(content_type: ContentType) -> type[BaseModel]:
    """``{"variations": [{"angle": ..., <payload fields>}]}`` model for a content type."""
    payload = get_spec(content_type).payload_model
    # ``angle`` first so the model commits to its assigned creative angle before writing.
    fields: dict[str, Any] = {
        "angle": (str, Field(description="The creative angle label assigned to this variation.")),
        **{name: (info.annotation, info) for name, info in payload.model_fields.items()},
    }
    variation = create_model(f"{payload.__name__}Variation", __config__=payload.model_config, **fields)
    return create_model(
        f"{payload.__name__}Variations",
        variations=(list[variation], Field(min_length=1, description="The requested variations, in order.")),
    )


@cache
def field_envelope(content_type: ContentType, field_name: str) -> type[BaseModel]:
    """``{"value": <field type>}`` model used to regenerate one component."""
    payload = get_spec(content_type).payload_model
    info = payload.model_fields[field_name]
    # Re-attach validators/constraints (e.g. hashtag normalisation, min lengths).
    annotation: Any = Annotated[(info.annotation, *info.metadata)] if info.metadata else info.annotation
    return create_model(
        f"{payload.__name__}_{field_name}_Regeneration",
        value=(annotation, Field(description=info.description or field_name)),
    )
