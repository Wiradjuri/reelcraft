"""OpenAI, OpenRouter and generic OpenAI-compatible servers (LM Studio, vLLM, Ollama…).

All three speak the Chat Completions API, so they share one adapter with small
per-provider differences (base URL, token parameter, structured-output support).
"""

from __future__ import annotations

import json
import re
from typing import Any, ClassVar

import httpx2
import openai

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

_NON_CHAT = re.compile(
    r"(embedding|whisper|tts|dall-e|davinci|babbage|moderation|realtime|audio|transcribe|image|search|"
    r"computer-use|codex|deep-research|sora)",
    re.I,
)


def _api_message(exc: openai.APIStatusError) -> str:
    body = exc.body
    if isinstance(body, dict):
        error = body.get("error", body)
        if isinstance(error, dict) and error.get("message"):
            return scrub_text(str(error["message"]))[:500]
    return scrub_text(str(exc.message))[:500]


def _error_code(exc: openai.APIStatusError) -> str:
    body = exc.body
    if isinstance(body, dict):
        error = body.get("error", body)
        if isinstance(error, dict):
            return str(error.get("code") or error.get("type") or "")
    return ""


def map_openai_error(exc: Exception, provider: str) -> AIError:
    if isinstance(exc, AIError):
        return exc
    if isinstance(exc, openai.APITimeoutError):
        return AITimeout(provider=provider)
    if isinstance(exc, openai.APIConnectionError):
        return AINetworkError(provider=provider, details={"reason": scrub_text(str(exc))[:300]})
    if isinstance(exc, openai.LengthFinishReasonError):
        return AIInvalidOutput(provider=provider, details={"reason": "response was cut off (token limit)"})
    if isinstance(exc, openai.ContentFilterFinishReasonError):
        return AIRefused(provider=provider)
    if isinstance(exc, openai.APIStatusError):
        details: dict[str, Any] = {"status": exc.status_code, "provider_message": _api_message(exc)}
        if isinstance(exc, openai.AuthenticationError):
            return AIAuthenticationError(provider=provider, details=details)
        if isinstance(exc, openai.PermissionDeniedError):
            return AIPermissionError(provider=provider, details=details)
        if isinstance(exc, openai.NotFoundError):
            return AIModelNotFound(provider=provider, details=details)
        if isinstance(exc, openai.RateLimitError):
            message = details["provider_message"].lower()
            if _error_code(exc) == "insufficient_quota" or any(w in message for w in ("credit", "quota", "billing")):
                return AIQuotaExceeded(provider=provider, details=details)
            return AIRateLimited(provider=provider, details=details)
        if exc.status_code == 402:
            return AIQuotaExceeded(provider=provider, details=details)
        if exc.status_code >= 500:
            return AIUnavailable(provider=provider, details=details)
        return AIBadRequest(provider=provider, details=details)
    return AIUnavailable(provider=provider, details={"reason": type(exc).__name__})


class OpenAIChatProvider(AIProvider):
    """Shared Chat Completions implementation."""

    default_base_url: ClassVar[str | None] = None
    # Newer OpenAI models take ``max_completion_tokens``; most compatible servers take ``max_tokens``.
    max_tokens_param: ClassVar[str] = "max_tokens"
    structured_modes: ClassVar[tuple[str, ...]] = ("json_schema",)
    extra_headers: ClassVar[dict[str, str]] = {}

    def __init__(
        self, config: ProviderConfig, *, http_client: httpx2.AsyncClient | None = None, max_retries: int = 1
    ) -> None:
        super().__init__(config)
        self._client = openai.AsyncOpenAI(
            api_key=config.api_key or "not-required",
            base_url=config.base_url or self.default_base_url,
            timeout=config.timeout_seconds,
            max_retries=max_retries,
            default_headers=self.extra_headers or None,
            http_client=http_client,
        )
        self._mode_index = 0

    async def generate_structured(self, request: StructuredRequest) -> StructuredResult:
        while True:
            mode = self.structured_modes[self._mode_index]
            try:
                return await self._call(request, mode)
            except openai.BadRequestError as exc:
                # Some compatible servers don't support json_schema; degrade gracefully.
                if self._mode_index + 1 < len(self.structured_modes):
                    self._mode_index += 1
                    continue
                raise map_openai_error(exc, self.name) from None
            except Exception as exc:
                raise map_openai_error(exc, self.name) from None

    async def _call(self, request: StructuredRequest, mode: str) -> StructuredResult:
        system = request.system
        response_format: dict[str, Any] | None
        if mode == "json_schema":
            response_format = {
                "type": "json_schema",
                "json_schema": {"name": request.schema_name, "schema": request.json_schema, "strict": True},
            }
        else:
            system += "\n\nRespond with a single JSON object matching this JSON schema:\n" + json.dumps(
                request.json_schema
            )
            response_format = {"type": "json_object"} if mode == "json_object" else None

        params: dict[str, Any] = {
            "model": request.target.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": request.user}],
            self.max_tokens_param: request.max_output_tokens,
            **self._model_params(request),
        }
        if response_format is not None:
            params["response_format"] = response_format
        completion = await self._client.chat.completions.create(**params)
        if not completion.choices:
            raise AIInvalidOutput(provider=self.name, details={"reason": "no choices returned"})
        choice = completion.choices[0]
        if getattr(choice.message, "refusal", None):
            raise AIRefused(provider=self.name, details={"provider_message": scrub_text(choice.message.refusal or "")})
        if choice.finish_reason == "length":
            raise AIInvalidOutput(provider=self.name, details={"reason": "response was cut off (token limit)"})
        data = parse_json_object(choice.message.content, self.name)
        usage = completion.usage
        return StructuredResult(
            data=data,
            model=completion.model or request.target.model,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
        )

    def _model_params(self, request: StructuredRequest) -> dict[str, Any]:
        return {}

    async def list_models(self) -> list[ModelInfo]:
        try:
            page = await self._client.models.list()
            models = [m async for m in page]
        except Exception as exc:
            raise map_openai_error(exc, self.name) from None
        return sorted(
            (ModelInfo(id=m.id, label=getattr(m, "name", None) or m.id) for m in models if self._is_chat_model(m.id)),
            key=lambda m: m.id,
        )

    def _is_chat_model(self, model_id: str) -> bool:
        return True

    async def close(self) -> None:
        await self._client.close()


class OpenAIProvider(OpenAIChatProvider):
    name = ProviderName.OPENAI
    max_tokens_param = "max_completion_tokens"

    def _model_params(self, request: StructuredRequest) -> dict[str, Any]:
        effort = request.target.params.get("reasoning_effort")
        return {"reasoning_effort": effort} if effort else {}

    def _is_chat_model(self, model_id: str) -> bool:
        return model_id.startswith(("gpt-", "o1", "o3", "o4", "chatgpt")) and not _NON_CHAT.search(model_id)


class OpenRouterProvider(OpenAIChatProvider):
    name = ProviderName.OPENROUTER
    default_base_url = "https://openrouter.ai/api/v1"
    structured_modes = ("json_schema", "json_object")
    extra_headers: ClassVar[dict[str, str]] = {"X-Title": "ReelCraft"}


class OpenAICompatibleProvider(OpenAIChatProvider):
    """LM Studio, Ollama, vLLM, LocalAI and other servers exposing ``/v1/chat/completions``."""

    name = ProviderName.OPENAI_COMPATIBLE
    structured_modes = ("json_schema", "json_object", "prompt")
