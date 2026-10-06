"""Provider factory and customer-facing provider metadata."""

from __future__ import annotations

from pydantic import BaseModel

from app.ai.providers.anthropic_provider import AnthropicProvider
from app.ai.providers.base import AIProvider
from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.openai_family import OpenAICompatibleProvider, OpenAIProvider, OpenRouterProvider
from app.ai.types import ProviderConfig, ProviderName

_PROVIDERS: dict[ProviderName, type[AIProvider]] = {
    ProviderName.OPENAI: OpenAIProvider,
    ProviderName.ANTHROPIC: AnthropicProvider,
    ProviderName.GEMINI: GeminiProvider,
    ProviderName.OPENROUTER: OpenRouterProvider,
    ProviderName.OPENAI_COMPATIBLE: OpenAICompatibleProvider,
}


class ProviderInfo(BaseModel):
    id: ProviderName
    label: str
    description: str
    requires_api_key: bool
    requires_base_url: bool
    base_url_placeholder: str = ""
    api_key_help_url: str = ""
    supports_model_discovery: bool = True


PROVIDER_INFO: dict[ProviderName, ProviderInfo] = {
    ProviderName.OPENAI: ProviderInfo(
        id=ProviderName.OPENAI,
        label="OpenAI",
        description="GPT models from OpenAI.",
        requires_api_key=True,
        requires_base_url=False,
        api_key_help_url="https://platform.openai.com/api-keys",
    ),
    ProviderName.ANTHROPIC: ProviderInfo(
        id=ProviderName.ANTHROPIC,
        label="Anthropic",
        description="Claude models from Anthropic.",
        requires_api_key=True,
        requires_base_url=False,
        api_key_help_url="https://console.anthropic.com/settings/keys",
    ),
    ProviderName.GEMINI: ProviderInfo(
        id=ProviderName.GEMINI,
        label="Google Gemini",
        description="Gemini models from Google AI Studio.",
        requires_api_key=True,
        requires_base_url=False,
        api_key_help_url="https://aistudio.google.com/apikey",
    ),
    ProviderName.OPENROUTER: ProviderInfo(
        id=ProviderName.OPENROUTER,
        label="OpenRouter",
        description="One key for hundreds of models from many providers.",
        requires_api_key=True,
        requires_base_url=False,
        api_key_help_url="https://openrouter.ai/keys",
    ),
    ProviderName.OPENAI_COMPATIBLE: ProviderInfo(
        id=ProviderName.OPENAI_COMPATIBLE,
        label="Local / custom server",
        description="LM Studio, Ollama, vLLM or any OpenAI-compatible server.",
        requires_api_key=False,
        requires_base_url=True,
        base_url_placeholder="http://localhost:1234/v1",
    ),
}


def create_provider(config: ProviderConfig) -> AIProvider:
    return _PROVIDERS[config.provider](config)
