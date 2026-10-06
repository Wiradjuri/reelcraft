"""Test doubles for the AI provider layer."""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from app.ai.providers.base import AIProvider
from app.ai.types import ModelInfo, ProviderConfig, ProviderName, StructuredRequest, StructuredResult

REEL = {
    "title": "Pumpkin latte reveal",
    "concept": "A cosy reveal of the returning seasonal latte.",
    "hook": "It's back. And it brought friends.",
    "opening_shot": "Close-up of steam rising from a ceramic cup, slow push-in.",
    "scenes": [
        {
            "timing": "0-3s",
            "visual": "Steam close-up",
            "action": "Barista slides cup",
            "on_screen_text": "It's back",
            "voiceover": "Guess what's back?",
        },
        {"timing": "3-15s", "visual": "Latte art pour", "action": "Pour", "on_screen_text": "", "voiceover": "Spiced."},
    ],
    "script": "Guess what's back? Spiced pumpkin oat latte.",
    "voiceover": "Warm, playful, unhurried.",
    "on_screen_text": ["It's back", "Spiced pumpkin oat latte"],
    "audio_suggestion": "Lo-fi acoustic, gentle tempo",
    "camera_setup": "Vertical, tripod, window light.",
    "b_roll": ["Milk steaming, over line 2"],
    "edit_notes": ["Hook text on screen from frame one", "Punch in on the reveal", "Subtitles on"],
    "thumbnail_text": "The latte everyone asked for",
    "details_to_confirm": ["[launch date]: the day it returns to the menu"],
    "caption": "Autumn in a cup is officially back.",
    "cta": "Tag who you're bringing this week",
    "hashtags": ["pumpkinlatte", "#MelbourneCoffee"],
    "estimated_duration_seconds": 30,
}
CAPTION = {
    "hook": "Autumn just walked in.",
    "body": "Autumn just walked in.\n\nOur latte is back.",
    "cta": "Visit us",
    "hashtags": ["#autumn"],
}
QUOTE = {
    "text": "Good coffee is slow on purpose.",
    "attribution": "Bloom & Brew",
    "category": "brand_statement",
    "caption": "Slow mornings.",
    "hashtags": ["#slowcoffee"],
    "card": {"headline": "Good coffee is slow on purpose.", "subtext": "Bloom & Brew", "visual_direction": "Warm"},
}
POST_IDEA = {
    "title": "Bean to cup",
    "format": "Carousel",
    "hook": "Where your coffee really starts",
    "outline": ["Slide 1: farm", "Slide 2: roast"],
    "visual_direction": "Earthy tones",
    "caption": "From farm to Fitzroy.",
    "cta": "Save this",
    "hashtags": ["#coffee"],
}
SAMPLES: dict[str, dict[str, Any]] = {"reel": REEL, "caption": CAPTION, "quote": QUOTE, "post_idea": POST_IDEA}
ANGLES = ["Direct", "Story-driven", "Conversational", "Bold", "Educational", "Curiosity", "Social proof", "Behind"]


def variations_payload(content_type: str, count: int) -> dict[str, Any]:
    variations = []
    for i in range(count):
        item = {**SAMPLES[content_type], "angle": ANGLES[i]}
        first_key = next(iter(SAMPLES[content_type]))
        item[first_key] = f"{item[first_key]} #{i + 1}"
        variations.append(item)
    return {"variations": variations}


def default_handler(request: StructuredRequest) -> dict[str, Any]:
    name = request.schema_name
    if name.endswith("_variations"):
        content_type = name.removesuffix("_variations")
        match = re.search(r"Create exactly (\d+) variation", request.user)
        return variations_payload(content_type, int(match.group(1)) if match else 1)
    content_type = next(ct for ct in SAMPLES if name.startswith(f"{ct}_"))
    field = name.removeprefix(f"{content_type}_")
    value = SAMPLES[content_type][field]
    if isinstance(value, str):
        value = f"Fresh {field}"
    return {"value": value}


class FakeProvider(AIProvider):
    name = ProviderName.OPENAI

    def __init__(
        self,
        config: ProviderConfig,
        handler: Callable[[StructuredRequest], dict[str, Any]] = default_handler,
        models: list[str] | None = None,
    ) -> None:
        super().__init__(config)
        self.name = config.provider
        self.handler = handler
        self.models = models or ["gpt-test"]
        self.requests: list[StructuredRequest] = []

    async def generate_structured(self, request: StructuredRequest) -> StructuredResult:
        self.requests.append(request)
        return StructuredResult(
            data=self.handler(request), model=request.target.model, input_tokens=100, output_tokens=200
        )

    async def list_models(self) -> list[ModelInfo]:
        return [ModelInfo(id=m) for m in self.models]


class FakeProviderFactory:
    """Records every provider instance; lets tests swap the handler per test."""

    def __init__(self) -> None:
        self.handler: Callable[[StructuredRequest], dict[str, Any]] = default_handler
        self.error: Exception | None = None
        self.instances: list[FakeProvider] = []

    def __call__(self, config: ProviderConfig) -> AIProvider:
        factory = self

        def handler(request: StructuredRequest) -> dict[str, Any]:
            if factory.error is not None:
                raise factory.error
            return factory.handler(request)

        provider = FakeProvider(config, handler)
        self.instances.append(provider)
        return provider

    @property
    def requests(self) -> list[StructuredRequest]:
        return [r for p in self.instances for r in p.requests]
