"""Structured output schemas and validation of AI responses."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from app.ai.errors import AIInvalidOutput
from app.ai.providers.base import parse_json_object
from app.content.json_schema import strict_json_schema
from app.content.options import ContentType
from app.content.registry import REGISTRY, field_envelope, variations_envelope
from app.content.schemas import normalise_hashtags
from tests.fakes import variations_payload


def _objects(node: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(node, dict):
        if node.get("type") == "object":
            found.append(node)
        for value in node.values():
            found.extend(_objects(value))
    elif isinstance(node, list):
        for value in node:
            found.extend(_objects(value))
    return found


@pytest.mark.parametrize("content_type", list(ContentType))
def test_strict_schema_is_provider_compatible(content_type: ContentType) -> None:
    schema = strict_json_schema(variations_envelope(content_type))
    assert "$defs" not in str(schema)
    assert "$ref" not in str(schema)
    for obj in _objects(schema):
        assert obj["additionalProperties"] is False
        assert set(obj["required"]) == set(obj["properties"])
    item = schema["properties"]["variations"]["items"]
    assert next(iter(item["properties"])) == "angle"


def test_property_named_title_survives_keyword_stripping() -> None:
    item = strict_json_schema(variations_envelope(ContentType.REEL))["properties"]["variations"]["items"]
    assert "title" in item["properties"]


@pytest.mark.parametrize("content_type", list(ContentType))
def test_valid_payloads_parse(content_type: ContentType) -> None:
    parsed = variations_envelope(content_type).model_validate(variations_payload(content_type.value, 2))
    assert len(parsed.variations) == 2  # type: ignore[attr-defined]


def test_blank_required_fields_are_rejected() -> None:
    bad = variations_payload("reel", 1)
    bad["variations"][0]["hook"] = "   "
    with pytest.raises(ValidationError):
        variations_envelope(ContentType.REEL).model_validate(bad)


def test_reel_requires_multiple_scenes_and_sane_duration() -> None:
    bad = variations_payload("reel", 1)
    bad["variations"][0]["scenes"] = bad["variations"][0]["scenes"][:1]
    with pytest.raises(ValidationError):
        variations_envelope(ContentType.REEL).model_validate(bad)
    bad = variations_payload("reel", 1)
    bad["variations"][0]["estimated_duration_seconds"] = 900
    with pytest.raises(ValidationError):
        variations_envelope(ContentType.REEL).model_validate(bad)


def test_hashtags_are_normalised() -> None:
    assert normalise_hashtags(["coffee", "#Coffee", "#flat white", "latte,art", "#!!"]) == [
        "#coffee",
        "#flat",
        "#white",
        "#latte",
        "#art",
    ]


def test_field_envelopes_keep_validators() -> None:
    hashtags = field_envelope(ContentType.CAPTION, "hashtags").model_validate({"value": ["a", "#a", "b"]})
    assert hashtags.value == ["#a", "#b"]  # type: ignore[attr-defined]
    with pytest.raises(ValidationError):
        field_envelope(ContentType.REEL, "hook").model_validate({"value": ""})


def test_every_regenerable_field_exists_on_its_payload() -> None:
    for spec in REGISTRY.values():
        for field in spec.regenerable_fields:
            assert field.name in spec.payload_model.model_fields


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ('{"a": 1}', {"a": 1}),
        ('```json\n{"a": 1}\n```', {"a": 1}),
        ('Sure! Here it is: {"a": {"b": 2}} Hope that helps', {"a": {"b": 2}}),
    ],
)
def test_parse_json_object_tolerates_wrappers(text: str, expected: dict[str, Any]) -> None:
    assert parse_json_object(text, "test") == expected


@pytest.mark.parametrize("text", ["", "not json", "[1, 2]", "{broken"])
def test_parse_json_object_rejects_garbage(text: str) -> None:
    with pytest.raises(AIInvalidOutput):
        parse_json_object(text, "test")
