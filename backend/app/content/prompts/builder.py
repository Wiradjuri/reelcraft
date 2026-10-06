"""Prompt builder: Brand + Platform + Content type + Objective + Tone + Request + Schema + Constraints."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel

from app.content.json_schema import strict_json_schema
from app.content.options import ContentType
from app.content.prompts import sections
from app.content.prompts.angles import Angle, angles_for
from app.content.registry import field_envelope, get_spec, variations_envelope
from app.content.requests import BrandContext, GenerationSpec

PROMPT_VERSION = "2026.10.1"


@dataclass(frozen=True)
class BuiltPrompt:
    """Everything a provider needs to make one structured-output call."""

    system: str
    user: str
    schema_name: str
    json_schema: dict[str, Any]
    output_model: type[BaseModel]
    max_output_tokens: int
    angles: list[Angle] = field(default_factory=list)
    version: str = PROMPT_VERSION


def build_generation_prompt(spec: GenerationSpec, brand: BrandContext) -> BuiltPrompt:
    type_spec = get_spec(spec.content_type)
    angles = angles_for(spec.content_type, spec.objective, spec.variations)
    model = variations_envelope(spec.content_type)
    parts = [
        sections.brand_section(brand),
        sections.platform_section(spec),
        sections.content_type_section(spec),
        sections.request_section(spec),
        sections.tone_instruction(spec, brand),
        sections.emoji_instruction(spec.options, brand),
        sections.hashtag_instruction(spec.options),
        sections.cta_instruction(spec.options, brand),
        sections.variations_section(angles),
    ]
    return BuiltPrompt(
        system=sections.SYSTEM_PROMPT,
        user="\n\n".join(parts),
        schema_name=f"{spec.content_type.value}_variations",
        json_schema=strict_json_schema(model),
        output_model=model,
        max_output_tokens=_budget(type_spec.output_tokens_per_variation * len(angles)),
        angles=angles,
    )


def build_field_prompt(
    *,
    spec: GenerationSpec,
    brand: BrandContext,
    current: dict[str, Any],
    field_name: str,
    instruction: str = "",
) -> BuiltPrompt:
    """Prompt to regenerate one component while keeping the rest of the content intact."""
    type_spec = get_spec(spec.content_type)
    regen = type_spec.field(field_name)
    if regen is None:
        raise ValueError(f"'{field_name}' cannot be regenerated for {spec.content_type.value}")
    model = field_envelope(ContentType(spec.content_type), field_name)
    current_json = json.dumps(current, ensure_ascii=False, indent=2)
    customer_instruction = (
        f"\n<request>\nCustomer's direction for the new version: {instruction.strip()}\n</request>"
        if instruction.strip()
        else ""
    )
    parts = [
        sections.brand_section(brand),
        sections.platform_section(spec),
        sections.content_type_section(spec),
        sections.request_section(spec),
        sections.tone_instruction(spec, brand),
        sections.emoji_instruction(spec.options, brand),
        f"<current_content>\n{current_json}\n</current_content>",
        (
            f"Task: write a fresh, clearly different version of the {regen.label.lower()} "
            f"(the `{field_name}` field) for the content above. {regen.guidance}\n"
            "Keep it consistent with every other part of the current content, which will not change. "
            "Do not repeat the current wording."
            f"{customer_instruction}\n"
            "Return it in the `value` field."
        ),
    ]
    if field_name == "hashtags":
        parts.insert(-1, sections.hashtag_instruction(spec.options))
    if field_name == "cta":
        parts.insert(-1, sections.cta_instruction(spec.options, brand))
    return BuiltPrompt(
        system=sections.SYSTEM_PROMPT,
        user="\n\n".join(parts),
        schema_name=f"{spec.content_type.value}_{field_name}",
        json_schema=strict_json_schema(model),
        output_model=model,
        max_output_tokens=_budget(max(400, type_spec.output_tokens_per_variation // 2)),
    )


def _budget(expected_tokens: int) -> int:
    # Reasoning models spend tokens before writing; leave generous headroom.
    return min(32_000, max(2_000, expected_tokens * 3 + 1_500))
