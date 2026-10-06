"""AI router: chooses a quality tier and model, then executes with validation and failover.

Responsibilities:

1. **Tier selection** — "Auto" maps a task to Fast or Professional from its complexity,
   number of variations and expected output length (policy lives in the catalogue).
2. **Model selection** — catalogue models for the tier, or customer overrides from
   Advanced Settings; unhealthy models are tried last.
3. **Execution** — calls the provider adapter, validates the structured output, retries
   once with a repair hint on malformed output, and fails over to the next model on
   retryable errors (rate limits, outages, timeouts).
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from threading import Lock
from typing import Literal

from pydantic import ValidationError

from app.ai.catalog import ModelCatalog
from app.ai.errors import AIError, AIInvalidOutput, AINotConfigured
from app.ai.providers.base import AIProvider
from app.ai.providers.registry import create_provider
from app.ai.types import ModelTarget, ProviderConfig, ProviderName, StructuredRequest, Tier
from app.content.options import ContentType, Quality
from app.content.registry import get_spec
from app.core.logging import get_logger

log = get_logger(__name__)


@dataclass(frozen=True)
class RoutingTask:
    content_type: ContentType
    kind: Literal["generate", "regenerate_field"]
    variations: int = 1
    expected_output_tokens: int = 0
    field_name: str | None = None


@dataclass(frozen=True)
class AIConnection:
    """Resolved AI access for a workspace (platform-managed or Bring Your Own AI)."""

    source: Literal["platform", "custom"]
    config: ProviderConfig
    tier_models: dict[Tier, str] = field(default_factory=dict)
    model_override: str | None = None


@dataclass(frozen=True)
class RoutePlan:
    tier: Tier
    provider: ProviderName
    source: str
    candidates: list[ModelTarget]


@dataclass
class RoutedResult[T]:
    value: T
    tier: Tier
    provider: ProviderName
    model: str
    source: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    attempts: int


class HealthTracker:
    """Tiny circuit breaker: a model that keeps failing is deprioritised for a while."""

    def __init__(self, threshold: int = 3, cooldown_seconds: float = 60.0) -> None:
        self.threshold = threshold
        self.cooldown = cooldown_seconds
        self._failures: dict[tuple[str, str], int] = {}
        self._open_until: dict[tuple[str, str], float] = {}
        self._lock = Lock()

    def is_healthy(self, provider: str, model: str) -> bool:
        return self._open_until.get((provider, model), 0.0) <= time.monotonic()

    def record_success(self, provider: str, model: str) -> None:
        with self._lock:
            self._failures.pop((provider, model), None)
            self._open_until.pop((provider, model), None)

    def record_failure(self, provider: str, model: str) -> None:
        with self._lock:
            key = (provider, model)
            self._failures[key] = self._failures.get(key, 0) + 1
            if self._failures[key] >= self.threshold:
                self._open_until[key] = time.monotonic() + self.cooldown
                self._failures[key] = 0


# Fields whose regeneration benefits from a stronger model under Auto.
_COMPLEX_FIELDS = {"scenes", "script"}


class AIRouter:
    def __init__(
        self,
        catalog: ModelCatalog,
        provider_factory: Callable[[ProviderConfig], AIProvider] = create_provider,
        health: HealthTracker | None = None,
    ) -> None:
        self.catalog = catalog
        self.provider_factory = provider_factory
        self.health = health or HealthTracker()

    # --- Planning ---------------------------------------------------------------
    def resolve_tier(self, quality: Quality, task: RoutingTask) -> Tier:
        if quality != Quality.AUTO:
            return Tier(quality.value)
        if task.kind == "regenerate_field":
            return Tier.PROFESSIONAL if task.field_name in _COMPLEX_FIELDS else Tier.FAST
        policy = self.catalog.auto
        score = get_spec(task.content_type).complexity
        if task.variations >= policy.many_variations_threshold:
            score += 1
        if task.expected_output_tokens >= policy.long_output_tokens:
            score += 1
        return Tier.FAST if score <= policy.fast_max_score else Tier.PROFESSIONAL

    def plan(self, quality: Quality, task: RoutingTask, connection: AIConnection) -> RoutePlan:
        tier = self.resolve_tier(quality, task)
        provider = connection.config.provider
        candidates = self._candidates(tier, connection)
        if not candidates:
            raise AINotConfigured(
                "Choose a model for your AI connection in Settings → AI & Integrations → Advanced.",
                provider=provider,
            )
        healthy = [c for c in candidates if self.health.is_healthy(provider, c.model)]
        ordered = healthy + [c for c in candidates if c not in healthy]
        return RoutePlan(tier=tier, provider=provider, source=connection.source, candidates=ordered)

    def _candidates(self, tier: Tier, connection: AIConnection) -> list[ModelTarget]:
        catalog_models = self.catalog.models_for(connection.config.provider, tier)
        if connection.model_override:
            return [ModelTarget(connection.model_override)]
        if chosen := connection.tier_models.get(tier):
            # Keep catalogue tuning if the chosen model is a catalogue model.
            match = next((m for m in catalog_models if m.model == chosen), None)
            rest = [m for m in catalog_models if m.model != chosen]
            return [match or ModelTarget(chosen), *rest]
        return catalog_models

    # --- Execution --------------------------------------------------------------
    async def run[T](
        self,
        plan: RoutePlan,
        connection: AIConnection,
        *,
        build_request: Callable[[ModelTarget, str], StructuredRequest],
        validate: Callable[[dict[str, object]], T],
    ) -> RoutedResult[T]:
        """Execute ``plan``. ``build_request(target, repair_hint)`` builds each attempt."""
        provider = self.provider_factory(connection.config)
        started = time.perf_counter()
        input_tokens = output_tokens = attempts = 0
        last_error: AIError | None = None
        try:
            for target in plan.candidates:
                repair_hint = ""
                for _ in range(2):  # one repair retry for malformed output
                    attempts += 1
                    try:
                        result = await provider.generate_structured(build_request(target, repair_hint))
                        input_tokens += result.input_tokens
                        output_tokens += result.output_tokens
                        value = validate(result.data)
                    except ValidationError as exc:
                        last_error = AIInvalidOutput(provider=plan.provider, details={"reason": _summarise(exc)})
                        repair_hint = _summarise(exc)
                        log.warning("ai.invalid_output", provider=plan.provider, model=target.model, reason=repair_hint)
                        continue
                    except AIInvalidOutput as exc:
                        last_error = exc
                        repair_hint = str(exc.details.get("reason", "invalid JSON"))
                        log.warning("ai.invalid_output", provider=plan.provider, model=target.model, reason=repair_hint)
                        continue
                    except AIError as exc:
                        last_error = exc
                        log.warning(
                            "ai.call_failed",
                            provider=plan.provider,
                            model=target.model,
                            code=exc.code,
                            failover=exc.failover,
                        )
                        if not exc.failover:
                            raise
                        self.health.record_failure(plan.provider, target.model)
                        break
                    self.health.record_success(plan.provider, target.model)
                    latency_ms = int((time.perf_counter() - started) * 1000)
                    log.info(
                        "ai.call_succeeded",
                        provider=plan.provider,
                        model=result.model,
                        tier=plan.tier,
                        source=plan.source,
                        attempts=attempts,
                        latency_ms=latency_ms,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                    )
                    return RoutedResult(
                        value=value,
                        tier=plan.tier,
                        provider=plan.provider,
                        model=result.model,
                        source=plan.source,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        latency_ms=latency_ms,
                        attempts=attempts,
                    )
                else:
                    self.health.record_failure(plan.provider, target.model)
        finally:
            await provider.close()
        assert last_error is not None
        raise last_error


def _summarise(exc: ValidationError) -> str:
    problems = [f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()[:6]]
    return "; ".join(problems)
