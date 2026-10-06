"""Convert Pydantic models into provider-friendly, strict JSON schemas.

Providers support different JSON-schema subsets. We emit the common denominator that
OpenAI strict mode, Anthropic structured outputs and Gemini all accept:

* ``$ref``/``$defs`` are inlined,
* every object has ``additionalProperties: false`` and lists all properties as required,
* validation keywords (lengths, ranges, defaults, titles) are removed — Pydantic
  re-applies them when the response is validated.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

_DROP_KEYS = {
    "title",
    "default",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "pattern",
    "format",
}


def strict_json_schema(model: type[BaseModel]) -> dict[str, Any]:
    raw = model.model_json_schema(mode="validation")
    defs = raw.pop("$defs", {})
    result: dict[str, Any] = _transform(raw, defs)
    return result


def _transform(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, list):
        return [_transform(item, defs) for item in node]
    if not isinstance(node, dict):
        return node
    if "$ref" in node:
        name = node["$ref"].rsplit("/", 1)[-1]
        resolved = dict(defs[name])
        if "description" in node:
            resolved["description"] = node["description"]
        return _transform(resolved, defs)
    result = {key: _transform(value, defs) for key, value in node.items() if key not in _DROP_KEYS | {"properties"}}
    if "properties" in node:
        # Property *names* are data, not keywords — never filter them (a field may be called "title").
        result["properties"] = {name: _transform(sub, defs) for name, sub in node["properties"].items()}
    if result.get("type") == "object" and "properties" in result:
        result["additionalProperties"] = False
        result["required"] = list(result["properties"].keys())
    return result
