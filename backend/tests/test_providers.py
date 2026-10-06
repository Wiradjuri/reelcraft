"""Provider adapters: request shape, response parsing and error translation (HTTP mocked)."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx2
import pytest

from app.ai import errors
from app.ai.providers.anthropic_provider import AnthropicProvider
from app.ai.providers.openai_family import OpenAICompatibleProvider, OpenAIProvider
from app.ai.types import ModelTarget, ProviderConfig, ProviderName, StructuredRequest

REQUEST = StructuredRequest(
    system="sys",
    user="usr",
    schema_name="caption_variations",
    json_schema={"type": "object", "properties": {"a": {"type": "string"}}, "required": ["a"]},
    max_output_tokens=500,
    target=ModelTarget("gpt-test", {"reasoning_effort": "low"}),
)


def mock_client(handler: Callable[[httpx2.Request], httpx2.Response]) -> httpx2.AsyncClient:
    return httpx2.AsyncClient(transport=httpx2.MockTransport(handler))


def completion(content: str, finish: str = "stop") -> dict[str, Any]:
    return {
        "id": "c1",
        "object": "chat.completion",
        "created": 0,
        "model": "gpt-test-2026",
        "choices": [{"index": 0, "finish_reason": finish, "message": {"role": "assistant", "content": content}}],
        "usage": {"prompt_tokens": 11, "completion_tokens": 22, "total_tokens": 33},
    }


def openai_provider(handler: Callable[[httpx2.Request], httpx2.Response], cls: type = OpenAIProvider) -> Any:
    config = ProviderConfig(provider=ProviderName.OPENAI, api_key="sk-test", base_url="http://mock/v1")
    return cls(config, http_client=mock_client(handler), max_retries=0)


async def test_openai_sends_strict_schema_and_parses_usage() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        captured.update(json.loads(request.content))
        return httpx2.Response(200, json=completion('{"a": "hello"}'))

    result = await openai_provider(handler).generate_structured(REQUEST)
    assert result.data == {"a": "hello"}
    assert (result.input_tokens, result.output_tokens, result.model) == (11, 22, "gpt-test-2026")
    assert captured["response_format"]["type"] == "json_schema"
    assert captured["response_format"]["json_schema"]["strict"] is True
    assert captured["max_completion_tokens"] == 500
    assert captured["reasoning_effort"] == "low"


@pytest.mark.parametrize(
    ("status", "body", "expected"),
    [
        (
            401,
            {"error": {"message": "Incorrect API key provided: sk-abc...", "code": "invalid_api_key"}},
            errors.AIAuthenticationError,
        ),
        (403, {"error": {"message": "no access"}}, errors.AIPermissionError),
        (404, {"error": {"message": "model not found"}}, errors.AIModelNotFound),
        (429, {"error": {"message": "slow down", "code": "rate_limit_exceeded"}}, errors.AIRateLimited),
        (429, {"error": {"message": "quota", "code": "insufficient_quota"}}, errors.AIQuotaExceeded),
        (
            429,
            {"error": {"message": "You have no credits remaining. Add credits to continue."}},
            errors.AIQuotaExceeded,
        ),
        (500, {"error": {"message": "boom"}}, errors.AIUnavailable),
        (400, {"error": {"message": "bad"}}, errors.AIBadRequest),
    ],
)
async def test_openai_errors_become_friendly_errors(status: int, body: dict[str, Any], expected: type) -> None:
    provider = openai_provider(lambda r: httpx2.Response(status, json=body))
    with pytest.raises(expected) as info:
        await provider.generate_structured(REQUEST)
    assert info.value.details["status"] == status
    assert "sk-abc" not in json.dumps(info.value.to_dict())


async def test_openai_network_error() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectError("connection refused")

    with pytest.raises(errors.AINetworkError):
        await openai_provider(handler).generate_structured(REQUEST)


async def test_truncated_and_refused_output() -> None:
    with pytest.raises(errors.AIInvalidOutput):
        await openai_provider(lambda r: httpx2.Response(200, json=completion('{"a":', "length"))).generate_structured(
            REQUEST
        )
    refusal = completion("")
    refusal["choices"][0]["message"]["refusal"] = "I can't help with that"
    with pytest.raises(errors.AIRefused):
        await openai_provider(lambda r: httpx2.Response(200, json=refusal)).generate_structured(REQUEST)


async def test_compatible_server_degrades_from_json_schema_to_json_mode() -> None:
    formats: list[Any] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        body = json.loads(request.content)
        formats.append(body.get("response_format", {}).get("type"))
        if formats[-1] == "json_schema":
            return httpx2.Response(400, json={"error": {"message": "response_format not supported"}})
        assert "max_tokens" in body
        return httpx2.Response(200, json=completion('```json\n{"a": "ok"}\n```'))

    result = await openai_provider(handler, OpenAICompatibleProvider).generate_structured(REQUEST)
    assert result.data == {"a": "ok"}
    assert formats == ["json_schema", "json_object"]


async def test_openai_model_discovery_filters_non_chat_models() -> None:
    models = {
        "object": "list",
        "data": [
            {"id": i, "object": "model", "created": 0, "owned_by": "x"}
            for i in ["gpt-5.4-mini", "text-embedding-3-small", "whisper-1", "gpt-5.5", "dall-e-3"]
        ],
    }
    found = await openai_provider(lambda r: httpx2.Response(200, json=models)).list_models()
    assert [m.id for m in found] == ["gpt-5.4-mini", "gpt-5.5"]


def anthropic_provider(handler: Callable[[httpx2.Request], httpx2.Response]) -> AnthropicProvider:
    config = ProviderConfig(provider=ProviderName.ANTHROPIC, api_key="sk-ant-test", base_url="http://mock")
    return AnthropicProvider(config, http_client=mock_client(handler), max_retries=0)


def message(text: str, stop: str = "end_turn") -> dict[str, Any]:
    return {
        "id": "m1",
        "type": "message",
        "role": "assistant",
        "model": "claude-test",
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop,
        "stop_sequence": None,
        "usage": {"input_tokens": 5, "output_tokens": 7},
    }


async def test_anthropic_uses_output_config_json_schema() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        captured.update(json.loads(request.content))
        return httpx2.Response(200, json=message('{"a": "hi"}'))

    request = StructuredRequest(**{**REQUEST.__dict__, "target": ModelTarget("claude-test", {"effort": "high"})})
    result = await anthropic_provider(handler).generate_structured(request)
    assert result.data == {"a": "hi"}
    assert result.output_tokens == 7
    assert captured["output_config"]["format"]["type"] == "json_schema"
    assert captured["output_config"]["effort"] == "high"
    assert captured["system"] == "sys"


async def test_anthropic_refusal_and_auth_errors() -> None:
    with pytest.raises(errors.AIRefused):
        await anthropic_provider(lambda r: httpx2.Response(200, json=message("", "refusal"))).generate_structured(
            REQUEST
        )
    auth = {"type": "error", "error": {"type": "authentication_error", "message": "invalid x-api-key"}}
    with pytest.raises(errors.AIAuthenticationError):
        await anthropic_provider(lambda r: httpx2.Response(401, json=auth)).generate_structured(REQUEST)
