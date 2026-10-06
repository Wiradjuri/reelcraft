"""Typed AI output payloads.

These Pydantic models are the single source of truth for structured AI output: the
JSON schema sent to providers is generated from them (see ``json_schema.py``) and every
response is validated against them before it is shown or stored.
"""

from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

_HASHTAG_CLEAN = re.compile(r"[^\w]", re.UNICODE)


def _strip(value: str) -> str:
    return value.strip()


Text = Annotated[str, AfterValidator(_strip)]
RequiredText = Annotated[str, AfterValidator(_strip), Field(min_length=1)]


def normalise_hashtags(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in values:
        for token in raw.replace(",", " ").split():
            tag = _HASHTAG_CLEAN.sub("", token.lstrip("#"))
            if tag and tag.lower() not in seen:
                seen.add(tag.lower())
                result.append(f"#{tag}")
    return result


Hashtags = Annotated[list[str], AfterValidator(normalise_hashtags)]


class _Payload(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class ReelScene(_Payload):
    timing: Text = Field(description="Time range within the reel, e.g. '0-3s'.")
    visual: RequiredText = Field(description="What the camera shows — shot type, framing, subject, movement.")
    action: Text = Field(description="What happens or what the presenter does in this shot.")
    on_screen_text: Text = Field(description="Text overlay for this shot, or an empty string if none.")
    voiceover: Text = Field(description="Spoken line(s) for this shot, or an empty string if none.")


class ReelProject(_Payload):
    title: RequiredText = Field(description="Short internal working title for the reel (max ~8 words).")
    concept: RequiredText = Field(description="One or two sentences explaining the creative idea and why it works.")
    hook: RequiredText = Field(
        description="The first 1-3 seconds: the exact opening line/visual that stops the scroll."
    )
    opening_shot: RequiredText = Field(description="Precise description of the very first frame and camera setup.")
    scenes: list[ReelScene] = Field(min_length=2, description="Shot-by-shot plan in order, covering the full duration.")
    script: RequiredText = Field(description="The complete spoken script from start to finish, ready to read aloud.")
    voiceover: Text = Field(description="Voice-over direction: delivery style, pace and energy.")
    on_screen_text: list[str] = Field(description="Ordered list of all text overlays used in the reel.")
    audio_suggestion: Text = Field(
        description="Music/sound direction (mood, tempo) — not a specific copyrighted track."
    )
    # Production fields added in prompt version 2026.10.2; defaults keep older saved reels valid.
    camera_setup: Text = Field(
        default="", description="How to film it: orientation, framing, support (tripod/handheld), light and sound."
    )
    b_roll: list[str] = Field(
        default_factory=list,
        description="Optional cutaway shots, each tied to the script line it covers. Empty if none are needed.",
    )
    edit_notes: list[str] = Field(
        default_factory=list,
        description="Editing instructions: where text appears, the one emphasis cut and which line it lands on, "
        "subtitles, end card.",
    )
    thumbnail_text: Text = Field(
        default="",
        description="Cover text, six words or fewer, promising the outcome or story. Never a repeat of the hook.",
    )
    details_to_confirm: list[str] = Field(
        default_factory=list,
        description="Every [bracketed] placeholder used in the script, with what real detail the brand must supply "
        "before filming. Empty if the script uses none.",
    )
    caption: RequiredText = Field(description="The Instagram caption to post with the reel, excluding hashtags.")
    cta: RequiredText = Field(description="The single call to action used in the reel and caption.")
    hashtags: Hashtags = Field(description="Relevant hashtags, each starting with #.")
    estimated_duration_seconds: int = Field(ge=5, le=180, description="Estimated runtime in seconds.")


class Caption(_Payload):
    hook: RequiredText = Field(description="The opening line that appears before 'more' — must earn the tap.")
    body: RequiredText = Field(
        description="The full caption text INCLUDING the hook as its first line, excluding hashtags."
    )
    cta: Text = Field(description="The call to action used in the caption, or an empty string if none was requested.")
    hashtags: Hashtags = Field(description="Relevant hashtags, each starting with #. Empty if hashtags are not wanted.")


class QuoteCard(_Payload):
    headline: RequiredText = Field(description="The main text for a quote card (may be a shortened form of the quote).")
    subtext: Text = Field(description="Optional smaller line for the card (attribution or context), or empty.")
    visual_direction: Text = Field(description="Suggested mood, colour and layout direction for a quote card.")


class Quote(_Payload):
    text: RequiredText = Field(description="The quote itself.")
    attribution: Text = Field(
        description="Who it is attributed to (usually the brand or empty). Never invent famous people."
    )
    category: Text = Field(description="The quote category.")
    caption: Text = Field(description="A short caption to accompany the quote when posted, excluding hashtags.")
    hashtags: Hashtags = Field(description="Relevant hashtags, each starting with #.")
    card: QuoteCard = Field(description="Text and direction for a visual quote card.")


class PostIdea(_Payload):
    title: RequiredText = Field(description="Short working title for the post.")
    format: RequiredText = Field(description="Best format: 'Carousel', 'Single image', 'Reel' or 'Story'.")
    hook: RequiredText = Field(description="The opening line or first-slide headline.")
    outline: list[str] = Field(min_length=1, description="Slide-by-slide or beat-by-beat outline.")
    visual_direction: Text = Field(description="Guidance for the imagery, design or footage.")
    caption: RequiredText = Field(description="Ready-to-post caption, excluding hashtags.")
    cta: RequiredText = Field(description="The call to action.")
    hashtags: Hashtags = Field(description="Relevant hashtags, each starting with #.")
