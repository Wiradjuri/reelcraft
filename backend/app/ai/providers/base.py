"""The provider interface every AI integration implements."""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Any

from app.ai.errors import AIInvalidOutput
from app.ai.types import ModelInfo, ProviderConfig, ProviderName, StructuredRequest, StructuredResult


class AIProvider(ABC):
    """Adapter boundary: provider SDK details never leak past this class."""

    name: ProviderName

    def __init__(self, config: ProviderConfig) -> None:
        self.config = config

    @abstractmethod
    async def generate_structured(self, request: StructuredRequest) -> StructuredResult:
        """Return JSON matching ``request.json_schema`` (validation happens upstream)."""

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]:
        """Models available to this account, where the provider supports discovery."""

    async def close(self) -> None:  # pragma: no cover - optional
        return None


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_json_object(text: str | None, provider: str) -> dict[str, Any]:
    """Parse a JSON object from model text, tolerating code fences and leading prose."""
    if not text or not text.strip():
        raise AIInvalidOutput(provider=provider, details={"reason": "empty response"})
    candidate = _FENCE.sub("", text.strip())
    try:
        value = json.loads(candidate)
    except json.JSONDecodeError:
        start, end = candidate.find("{"), candidate.rfind("}")
        if start == -1 or end <= start:
            raise AIInvalidOutput(provider=provider, details={"reason": "response was not JSON"}) from None
        try:
            value = json.loads(candidate[start : end + 1])
        except json.JSONDecodeError as exc:
            raise AIInvalidOutput(provider=provider, details={"reason": f"invalid JSON: {exc.msg}"}) from None
    if not isinstance(value, dict):
        raise AIInvalidOutput(provider=provider, details={"reason": "JSON was not an object"})
    return value
