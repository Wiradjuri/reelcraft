"""Provider-neutral request/response types."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class ProviderName(StrEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OPENROUTER = "openrouter"
    OPENAI_COMPATIBLE = "openai_compatible"


class Tier(StrEnum):
    FAST = "fast"
    PROFESSIONAL = "professional"
    PREMIUM = "premium"


@dataclass(frozen=True)
class ProviderConfig:
    provider: ProviderName
    api_key: str | None = None
    base_url: str | None = None
    timeout_seconds: float = 120.0

    def __repr__(self) -> str:  # never print the key
        return f"ProviderConfig(provider={self.provider!s}, base_url={self.base_url!r}, api_key=***)"


@dataclass(frozen=True)
class ModelTarget:
    """A concrete model plus provider-specific tuning (e.g. reasoning effort)."""

    model: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class StructuredRequest:
    system: str
    user: str
    schema_name: str
    json_schema: dict[str, Any]
    max_output_tokens: int
    target: ModelTarget


@dataclass(frozen=True)
class StructuredResult:
    data: dict[str, Any]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass(frozen=True)
class ModelInfo:
    id: str
    label: str = ""
