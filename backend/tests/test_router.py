"""AI routing: tier selection, model selection, failover, repair retries and health."""

from __future__ import annotations

from typing import Any

import pytest

from app.ai.catalog import get_catalog
from app.ai.errors import AIAuthenticationError, AIInvalidOutput, AINotConfigured, AIRateLimited
from app.ai.router import AIConnection, AIRouter, HealthTracker, RoutingTask
from app.ai.types import ModelTarget, ProviderConfig, ProviderName, StructuredRequest, Tier
from app.content.options import ContentType, Quality
from tests.fakes import FakeProvider

PLATFORM = AIConnection(source="platform", config=ProviderConfig(provider=ProviderName.OPENAI, api_key="k"))


def router_with(handler: Any, health: HealthTracker | None = None) -> tuple[AIRouter, list[FakeProvider]]:
    created: list[FakeProvider] = []

    def factory(config: ProviderConfig) -> FakeProvider:
        provider = FakeProvider(config, handler)
        created.append(provider)
        return provider

    return AIRouter(get_catalog(), provider_factory=factory, health=health), created


def build(target: ModelTarget, hint: str) -> StructuredRequest:
    return StructuredRequest(
        system="s", user=f"u{hint}", schema_name="x", json_schema={}, max_output_tokens=100, target=target
    )


@pytest.mark.parametrize(
    ("task", "tier"),
    [
        (RoutingTask(ContentType.CAPTION, "generate", variations=3, expected_output_tokens=1000), Tier.FAST),
        (RoutingTask(ContentType.QUOTE, "generate", variations=5, expected_output_tokens=1100), Tier.FAST),
        (RoutingTask(ContentType.REEL, "generate", variations=3, expected_output_tokens=4200), Tier.PROFESSIONAL),
        (RoutingTask(ContentType.POST_IDEA, "generate", variations=4, expected_output_tokens=2400), Tier.PROFESSIONAL),
        (RoutingTask(ContentType.REEL, "regenerate_field", field_name="hook"), Tier.FAST),
        (RoutingTask(ContentType.REEL, "regenerate_field", field_name="script"), Tier.PROFESSIONAL),
    ],
)
def test_auto_tier_policy(task: RoutingTask, tier: Tier) -> None:
    router, _ = router_with(lambda r: {})
    assert router.resolve_tier(Quality.AUTO, task) == tier


def test_explicit_quality_wins_and_auto_never_picks_premium() -> None:
    router, _ = router_with(lambda r: {})
    task = RoutingTask(ContentType.REEL, "generate", variations=4, expected_output_tokens=9000)
    assert router.resolve_tier(Quality.PREMIUM, task) == Tier.PREMIUM
    assert router.resolve_tier(Quality.FAST, task) == Tier.FAST
    assert router.resolve_tier(Quality.AUTO, task) == Tier.PROFESSIONAL


def test_plan_uses_catalog_then_customer_overrides() -> None:
    router, _ = router_with(lambda r: {})
    task = RoutingTask(ContentType.CAPTION, "generate")
    catalog_models = [m.model for m in get_catalog().models_for(ProviderName.OPENAI, Tier.FAST)]
    assert [c.model for c in router.plan(Quality.FAST, task, PLATFORM).candidates] == catalog_models

    custom = AIConnection(source="custom", config=PLATFORM.config, tier_models={Tier.FAST: "my-model"})
    assert router.plan(Quality.FAST, task, custom).candidates[0].model == "my-model"

    override = AIConnection(source="custom", config=PLATFORM.config, model_override="only-this")
    assert [c.model for c in router.plan(Quality.PREMIUM, task, override).candidates] == ["only-this"]


def test_compatible_server_without_model_needs_configuration() -> None:
    router, _ = router_with(lambda r: {})
    local = AIConnection(
        source="custom", config=ProviderConfig(provider=ProviderName.OPENAI_COMPATIBLE, base_url="http://x")
    )
    with pytest.raises(AINotConfigured):
        router.plan(Quality.AUTO, RoutingTask(ContentType.CAPTION, "generate"), local)


async def test_failover_to_next_model_on_rate_limit() -> None:
    def handler(request: StructuredRequest) -> dict[str, Any]:
        if request.target.model == "gpt-5.4-mini":
            raise AIRateLimited()
        return {"ok": True}

    router, _ = router_with(handler)
    plan = router.plan(Quality.FAST, RoutingTask(ContentType.CAPTION, "generate"), PLATFORM)
    result = await router.run(plan, PLATFORM, build_request=build, validate=lambda d: d)
    assert result.model == plan.candidates[1].model
    assert result.attempts == 2


async def test_invalid_output_gets_one_repair_retry_with_hint() -> None:
    seen: list[str] = []

    def handler(request: StructuredRequest) -> dict[str, Any]:
        seen.append(request.user)
        if len(seen) == 1:
            raise AIInvalidOutput(details={"reason": "missing hook"})
        return {"ok": True}

    router, _ = router_with(handler)
    plan = router.plan(Quality.FAST, RoutingTask(ContentType.CAPTION, "generate"), PLATFORM)
    result = await router.run(plan, PLATFORM, build_request=build, validate=lambda d: d)
    assert result.value == {"ok": True}
    assert seen == ["u", "umissing hook"]


async def test_validation_errors_trigger_repair_then_failover_then_raise() -> None:
    from pydantic import BaseModel

    class Strict(BaseModel):
        needed: str

    router, _ = router_with(lambda r: {"wrong": 1})
    plan = router.plan(Quality.FAST, RoutingTask(ContentType.CAPTION, "generate"), PLATFORM)
    with pytest.raises(AIInvalidOutput):
        await router.run(plan, PLATFORM, build_request=build, validate=Strict.model_validate)


async def test_authentication_errors_do_not_fail_over() -> None:
    calls: list[str] = []

    def handler(request: StructuredRequest) -> dict[str, Any]:
        calls.append(request.target.model)
        raise AIAuthenticationError()

    router, _ = router_with(handler)
    plan = router.plan(Quality.FAST, RoutingTask(ContentType.CAPTION, "generate"), PLATFORM)
    with pytest.raises(AIAuthenticationError):
        await router.run(plan, PLATFORM, build_request=build, validate=lambda d: d)
    assert len(calls) == 1


def test_unhealthy_models_are_tried_last() -> None:
    health = HealthTracker(threshold=1, cooldown_seconds=60)
    router, _ = router_with(lambda r: {}, health)
    task = RoutingTask(ContentType.CAPTION, "generate")
    first = router.plan(Quality.FAST, task, PLATFORM).candidates[0].model
    health.record_failure("openai", first)
    assert router.plan(Quality.FAST, task, PLATFORM).candidates[-1].model == first
    health.record_success("openai", first)
    assert router.plan(Quality.FAST, task, PLATFORM).candidates[0].model == first
