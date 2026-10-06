"""Google Gemini adapter (google-genai SDK, JSON-schema constrained output)."""

from __future__ import annotations

from typing import Any

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.ai.errors import (
    AIAuthenticationError,
    AIBadRequest,
    AIError,
    AIInvalidOutput,
    AIModelNotFound,
    AINetworkError,
    AIPermissionError,
    AIRateLimited,
    AIRefused,
    AITimeout,
    AIUnavailable,
)
from app.ai.providers.base import AIProvider, parse_json_object
from app.ai.types import ModelInfo, ProviderConfig, ProviderName, StructuredRequest, StructuredResult
from app.core.logging import scrub_text


def map_gemini_error(exc: Exception, provider: str = ProviderName.GEMINI) -> AIError:
    if isinstance(exc, AIError):
        return exc
    if isinstance(exc, httpx.TimeoutException) or "Timeout" in type(exc).__name__:
        return AITimeout(provider=provider)
    if isinstance(exc, httpx.TransportError) or "ConnectError" in type(exc).__name__:
        return AINetworkError(provider=provider, details={"reason": scrub_text(str(exc))[:300]})
    if isinstance(exc, genai_errors.APIError):
        message = scrub_text(str(exc.message or ""))[:500]
        details = {"status": exc.code, "provider_message": message}
        lowered = message.lower()
        if exc.code == 400 and "api key" in lowered:
            return AIAuthenticationError(provider=provider, details=details)
        if exc.code == 401:
            return AIAuthenticationError(provider=provider, details=details)
        if exc.code == 403:
            return AIPermissionError(provider=provider, details=details)
        if exc.code == 404:
            return AIModelNotFound(provider=provider, details=details)
        if exc.code == 429:
            return AIRateLimited(provider=provider, details=details)
        if exc.code >= 500:
            return AIUnavailable(provider=provider, details=details)
        return AIBadRequest(provider=provider, details=details)
    return AIUnavailable(provider=provider, details={"reason": type(exc).__name__})


class GeminiProvider(AIProvider):
    name = ProviderName.GEMINI

    def __init__(self, config: ProviderConfig) -> None:
        super().__init__(config)
        http_options: dict[str, Any] = {"timeout": int(config.timeout_seconds * 1000)}
        if config.base_url:
            http_options["base_url"] = config.base_url
        self._client = genai.Client(api_key=config.api_key, http_options=types.HttpOptions(**http_options))

    async def generate_structured(self, request: StructuredRequest) -> StructuredResult:
        config_kwargs: dict[str, Any] = {
            "system_instruction": request.system,
            "response_mime_type": "application/json",
            "response_json_schema": request.json_schema,
            "max_output_tokens": request.max_output_tokens,
        }
        if (budget := request.target.params.get("thinking_budget")) is not None:
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=int(budget))
        try:
            response = await self._client.aio.models.generate_content(
                model=request.target.model,
                contents=request.user,
                config=types.GenerateContentConfig(**config_kwargs),
            )
        except Exception as exc:
            raise map_gemini_error(exc) from None

        candidate = response.candidates[0] if response.candidates else None
        finish = str(candidate.finish_reason) if candidate and candidate.finish_reason else ""
        if "SAFETY" in finish or "PROHIBITED" in finish or "BLOCKLIST" in finish:
            raise AIRefused(provider=self.name)
        if "MAX_TOKENS" in finish:
            raise AIInvalidOutput(provider=self.name, details={"reason": "response was cut off (token limit)"})
        usage = response.usage_metadata
        return StructuredResult(
            data=parse_json_object(response.text, self.name),
            model=response.model_version or request.target.model,
            input_tokens=(usage.prompt_token_count or 0) if usage else 0,
            output_tokens=(usage.candidates_token_count or 0) if usage else 0,
        )

    async def list_models(self) -> list[ModelInfo]:
        try:
            pager = await self._client.aio.models.list()
            models = [m async for m in pager]
        except Exception as exc:
            raise map_gemini_error(exc) from None
        result: list[ModelInfo] = []
        for model in models:
            actions = model.supported_actions or []
            if "generateContent" in actions and model.name and "gemini" in model.name:
                result.append(ModelInfo(id=model.name.removeprefix("models/"), label=model.display_name or model.name))
        return result
