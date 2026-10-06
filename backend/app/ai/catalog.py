"""Loads the model catalogue (tier → models per provider) from TOML."""

from __future__ import annotations

import tomllib
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.ai.types import ModelTarget, ProviderName, Tier

DEFAULT_CATALOG_PATH = Path(__file__).with_name("model_catalog.toml")


class TierInfo(BaseModel):
    label: str
    relative_cost: int = 1
    relative_latency: int = 1


class AutoPolicy(BaseModel):
    fast_max_score: int = 2
    many_variations_threshold: int = 4
    long_output_tokens: int = 4000


class CatalogModel(BaseModel):
    model: str
    params: dict[str, Any] = Field(default_factory=dict)

    def target(self) -> ModelTarget:
        return ModelTarget(model=self.model, params=dict(self.params))


class ModelCatalog(BaseModel):
    tiers: dict[Tier, TierInfo]
    auto: AutoPolicy = Field(default_factory=AutoPolicy)
    providers: dict[ProviderName, dict[Tier, list[CatalogModel]]] = Field(default_factory=dict)

    def models_for(self, provider: ProviderName, tier: Tier) -> list[ModelTarget]:
        return [m.target() for m in self.providers.get(provider, {}).get(tier, [])]


def load_catalog(path: Path | None = None) -> ModelCatalog:
    with (path or DEFAULT_CATALOG_PATH).open("rb") as fh:
        return ModelCatalog.model_validate(tomllib.load(fh))


@lru_cache
def get_catalog(path: Path | None = None) -> ModelCatalog:
    return load_catalog(path)
