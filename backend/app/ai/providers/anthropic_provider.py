"""Anthropic (Claude) adapter using structured outputs (``output_config.format``)."""

from __future__ import annotations

from typing import Any

import anthropic
import httpx2

from app.ai.errors import (
    AIAuthenticationError,
    AIBadRequest,
    AIError,
    AIInvalidOutput,
    AIModelNotFound,
    AINetworkError,
    AIPermissionError,
    AIQuotaExceeded,
    AIRateLimited,
    AIRefused,
    AITimeout,
    AIUnavailable,
)
from app.ai.providers.base import AIProvider, parse_json_object
from app.ai.types import ModelInfo, ProviderConfig, ProviderName, StructuredRequest, StructuredResult
from app.core.logging import scrub_text


def _api_message(exc: anthropic.APIStatusError) -> str:
    body = exc.body
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict) and error.get("message"):
            return scrub_text(str(error["message"]))[:500]
    return scrub_text(str(exc.message))[:500]


def map_anthropic_error(exc: Exception, provider: str = ProviderName.ANTHROPIC) -> AIError:
    if isinstance(exc, AIError):
        return exc
    if isinstance(exc, anthropic.APITimeoutError):
        return AITimeout(provider=provider)
    if isinstance(exc, anthropic.APIConnectionError):
        return AINetworkError(provider=provider, details={"reason": scrub_text(str(exc))[:300]})
    if isinstance(exc, anthropic.APIStatusError):
        details = {"status": exc.status_code, "provider_message": _api_message(exc)}
        if isinstance(exc, anthropic.AuthenticationError):
            return AIAuthenticationError(provider=provider, details=details)
        if isinstance(exc, anthropic.PermissionDeniedError):
            return AIPermissionError(provider=provider, details=details)
        if isinstance(exc, anthropic.NotFoundError):
            return AIModelNotFound(provider=provider, details=details)
        if isinstance(exc, anthropic.RateLimitError):
            return AIRateLimited(provider=provider, details=details)
        if exc.status_code == 402 or "credit balance" in _api_message(exc).lower():
            return AIQuotaExceeded(provider=provider, details=details)
        if exc.status_code >= 500 or exc.status_code == 529:
            return AIUnavailable(provider=provider, details=details)
        return AIBadRequest(provider=provider, details=details)
    return AIUnavailable(provider=provider, details={"reason": type(exc).__name__})


class AnthropicProvider(AIProvider):
    name = ProviderName.ANTHROPIC

    def __init__(
        self, config: ProviderConfig, *, http_client: httpx2.AsyncClient | None = None, max_retries: int = 1
    ) -> None:
        super().__init__(config)
        kwargs: dict[str, Any] = {
            "api_key": config.api_key,
            "timeout": config.timeout_seconds,
            "max_retries": max_retries,
            "http_client": http_client,
        }
        if config.base_url:
            kwargs["base_url"] = config.base_url
        self._client = anthropic.AsyncAnthropic(**kwargs)

    async def generate_structured(self, request: StructuredRequest) -> StructuredResult:
        output_config: dict[str, Any] = {"format": {"type": "json_schema", "schema": request.json_schema}}
        if effort := request.target.params.get("effort"):
            output_config["effort"] = effort
        params: dict[str, Any] = {
            "model": request.target.model,
            "max_tokens": request.max_output_tokens,
            "system": request.system,
            "messages": [{"role": "user", "content": request.user}],
            "output_config": output_config,
        }
        try:
            message = await self._client.messages.create(**params)
        except Exception as exc:
            raise map_anthropic_error(exc) from None

        if message.stop_reason == "refusal":
            raise AIRefused(provider=self.name)
        if message.stop_reason == "max_tokens":
            raise AIInvalidOutput(provider=self.name, details={"reason": "response was cut off (token limit)"})
        text = "".join(block.text for block in message.content if block.type == "text")
        return StructuredResult(
            data=parse_json_object(text, self.name),
            model=message.model,
            input_tokens=message.usage.input_tokens,
            output_tokens=message.usage.output_tokens,
        )

    async def list_models(self) -> list[ModelInfo]:
        try:
            models = [m async for m in self._client.models.list(limit=100)]
        except Exception as exc:
            raise map_anthropic_error(exc) from None
        return [ModelInfo(id=m.id, label=m.display_name) for m in models]

    async def close(self) -> None:
        await self._client.close()
