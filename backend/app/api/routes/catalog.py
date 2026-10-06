"""Customer-facing option lists, so the UI never hard-codes labels or choices."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.ai.providers.registry import PROVIDER_INFO
from app.content import options as o
from app.content.registry import REGISTRY

router = APIRouter(tags=["catalog"])


def _opts(labels: dict[Any, tuple[str, str]]) -> list[dict[str, str]]:
    return [{"value": k.value, "label": v[0], "description": v[1]} for k, v in labels.items()]


@router.get("/catalog")
async def catalog() -> dict[str, Any]:
    return {
        "platforms": [
            {
                "value": p.value.value,
                "label": p.label,
                "available": p.available,
                "caption_max_chars": p.caption_max_chars,
            }
            for p in o.PLATFORMS.values()
        ],
        "content_types": [
            {
                "value": ct.value,
                "label": o.CONTENT_TYPE_LABELS[ct][0],
                "description": o.CONTENT_TYPE_LABELS[ct][1],
                "default_variations": spec.default_variations,
                "max_variations": spec.max_variations,
                "regenerable_fields": [{"name": f.name, "label": f.label} for f in spec.regenerable_fields],
            }
            for ct, spec in REGISTRY.items()
        ],
        "objectives": _opts(o.OBJECTIVE_LABELS),
        "tones": _opts(o.TONE_LABELS),
        "qualities": _opts(o.QUALITY_LABELS),
        "caption_lengths": [
            {"value": "short", "label": "Short", "description": "1-2 sentences"},
            {"value": "medium", "label": "Medium", "description": "A short paragraph or two"},
            {"value": "long", "label": "Long", "description": "Micro-blog style"},
        ],
        "caption_styles": [{"value": k.value, "label": v} for k, v in o.CAPTION_STYLE_LABELS.items()],
        "quote_categories": [{"value": k.value, "label": v} for k, v in o.QUOTE_CATEGORY_LABELS.items()],
        "emoji_styles": [
            {"value": "none", "label": "No emojis"},
            {"value": "light", "label": "A few emojis"},
            {"value": "expressive", "label": "Expressive"},
        ],
        "reel_durations": list(o.REEL_DURATIONS),
        "ai_providers": [info.model_dump(mode="json") for info in PROVIDER_INFO.values()],
    }
