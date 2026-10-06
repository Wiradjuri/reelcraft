"""Content generation: the business logic between the API and the AI router.

GUI → API → **ContentGenerationService** → AIRouter → Provider adapter → AI provider
"""

from __future__ import annotations

import uuid
from typing import Any, cast

from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.errors import AIError
from app.ai.router import AIRouter, RoutedResult, RoutingTask
from app.ai.types import ModelTarget, StructuredRequest
from app.content.options import PLATFORMS, ContentType
from app.content.prompts.builder import BuiltPrompt, build_field_prompt, build_generation_prompt
from app.content.registry import get_spec
from app.content.requests import BrandContext, GenerationSpec
from app.core.errors import NotFoundError, ValidationFailed
from app.core.logging import get_logger
from app.db.models import ContentGeneration, ContentItem, UsageEvent
from app.schemas.generation import GenerateRequest
from app.services.ai_settings import AISettingsService
from app.services.brands import BrandService
from app.services.context import RequestContext

log = get_logger(__name__)

REPAIR_NOTE = (
    "\n\nIMPORTANT: your previous response could not be used ({hint}). "
    "Return a complete JSON object that exactly matches the schema, with every required field filled in."
)


def _structured_request(prompt: BuiltPrompt, target: ModelTarget, repair_hint: str) -> StructuredRequest:
    user = prompt.user + (REPAIR_NOTE.format(hint=repair_hint[:400]) if repair_hint else "")
    return StructuredRequest(
        system=prompt.system,
        user=user,
        schema_name=prompt.schema_name,
        json_schema=prompt.json_schema,
        max_output_tokens=prompt.max_output_tokens,
        target=target,
    )


class ContentGenerationService:
    def __init__(self, db: AsyncSession, router: AIRouter, ai_settings: AISettingsService) -> None:
        self.db = db
        self.router = router
        self.ai_settings = ai_settings
        self.brands = BrandService(db)

    # --- Generate ---------------------------------------------------------------
    async def generate(self, ctx: RequestContext, request: GenerateRequest) -> ContentGeneration:
        ctx.require("editor")
        if not PLATFORMS[request.platform].available:
            raise ValidationFailed(
                f"{PLATFORMS[request.platform].label} support is coming soon.", title="Not available yet"
            )
        brand = await self.brands.resolve(ctx, request.brand_id)
        brand_ctx = BrandContext.model_validate(brand)
        spec = GenerationSpec.model_validate(request.model_dump(exclude={"brand_id"}))
        prompt = build_generation_prompt(spec, brand_ctx)
        connection = await self.ai_settings.resolve_connection(ctx)
        task = RoutingTask(
            content_type=spec.content_type,
            kind="generate",
            variations=spec.variations,
            expected_output_tokens=get_spec(spec.content_type).output_tokens_per_variation * spec.variations,
        )
        plan = self.router.plan(spec.quality, task, connection)
        envelope = prompt.output_model
        generation = ContentGeneration(
            id=uuid.uuid4(),
            workspace_id=ctx.workspace.id,
            brand_id=brand.id,
            created_by_id=ctx.user.id,
            platform=spec.platform.value,
            content_type=spec.content_type.value,
            request=spec.model_dump(mode="json"),
            brand_snapshot=brand_ctx.model_dump(mode="json"),
            quality_requested=spec.quality.value,
            quality_resolved=plan.tier.value,
            ai_source=connection.source,
            provider=plan.provider.value,
            prompt_version=prompt.version,
        )
        log.info(
            "generation.started",
            workspace_id=str(ctx.workspace.id),
            content_type=spec.content_type,
            variations=spec.variations,
            tier=plan.tier,
            source=connection.source,
        )
        try:
            result: RoutedResult[BaseModel] = await self.router.run(
                plan,
                connection,
                build_request=lambda target, hint: _structured_request(prompt, target, hint),
                validate=lambda data: self._validate_variations(envelope, data, spec.variations),
            )
        except AIError as exc:
            generation.status = "failed"
            generation.error_code = exc.code
            generation.title = spec.topic[:200]
            self.db.add(generation)
            self.db.add(self._usage(ctx, generation, "generate", plan.tier.value, connection.source, "", None))
            await self.db.commit()
            raise

        variations = cast(Any, result.value).variations
        spec_info = get_spec(spec.content_type)
        generation.model = result.model
        generation.input_tokens = result.input_tokens
        generation.output_tokens = result.output_tokens
        generation.latency_ms = result.latency_ms
        for position, variation in enumerate(variations):
            data = variation.model_dump(mode="json")
            angle = str(
                data.pop("angle", "") or (prompt.angles[position].label if position < len(prompt.angles) else "")
            )
            generation.items.append(
                ContentItem(
                    workspace_id=ctx.workspace.id,
                    content_type=spec.content_type.value,
                    position=position,
                    angle=angle[:60],
                    data=data,
                )
            )
        generation.title = spec_info.title_for(generation.items[0].data) or spec.topic[:200]
        self.db.add(generation)
        await self.db.flush()
        self.db.add(self._usage(ctx, generation, "generate", plan.tier.value, connection.source, result.model, result))
        await self.db.commit()
        log.info("generation.succeeded", generation_id=str(generation.id), items=len(variations))
        return await self.get(ctx, generation.id)

    @staticmethod
    def _validate_variations(envelope: type[BaseModel], data: dict[str, Any], expected: int) -> BaseModel:
        parsed = envelope.model_validate(data)
        variations = cast(Any, parsed).variations
        if len(variations) > expected:
            cast(Any, parsed).variations = variations[:expected]
        return parsed

    # --- Regenerate one component ----------------------------------------------
    async def regenerate_field(
        self, ctx: RequestContext, item_id: uuid.UUID, field: str, instruction: str = ""
    ) -> ContentItem:
        ctx.require("editor")
        item = await self.get_item(ctx, item_id)
        generation = item.generation
        content_type = ContentType(item.content_type)
        if get_spec(content_type).field(field) is None:
            raise ValidationFailed(f"'{field}' can't be regenerated for this content.", details={"field": "field"})
        spec = GenerationSpec.model_validate(generation.request)
        brand_ctx = await self._brand_context(ctx, generation)
        prompt = build_field_prompt(
            spec=spec, brand=brand_ctx, current=item.data, field_name=field, instruction=instruction
        )
        connection = await self.ai_settings.resolve_connection(ctx)
        task = RoutingTask(content_type=content_type, kind="regenerate_field", field_name=field)
        plan = self.router.plan(spec.quality, task, connection)
        payload_model = get_spec(content_type).payload_model
        current = dict(item.data)

        def validate(data: dict[str, Any]) -> dict[str, Any]:
            value = prompt.output_model.model_validate(data).model_dump(mode="json")["value"]
            # Validate the whole payload with the new value so components stay consistent.
            merged: dict[str, Any] = payload_model.model_validate({**current, field: value}).model_dump(mode="json")
            return merged

        try:
            result = await self.router.run(
                plan,
                connection,
                build_request=lambda target, hint: _structured_request(prompt, target, hint),
                validate=validate,
            )
        except AIError:
            self.db.add(self._usage(ctx, generation, "regenerate_field", plan.tier.value, connection.source, "", None))
            await self.db.commit()
            raise
        item.data = result.value
        item.is_edited = True
        self.db.add(
            self._usage(ctx, generation, "regenerate_field", plan.tier.value, connection.source, result.model, result)
        )
        await self.db.commit()
        log.info("generation.field_regenerated", item_id=str(item.id), field=field)
        return item

    async def _brand_context(self, ctx: RequestContext, generation: ContentGeneration) -> BrandContext:
        """Prefer the brand's *current* profile (it may have improved); fall back to the snapshot."""
        if generation.brand_id:
            try:
                return BrandContext.model_validate(await self.brands.get(ctx, generation.brand_id))
            except NotFoundError:
                pass
        return BrandContext.model_validate(generation.brand_snapshot)

    # --- Manual edits -----------------------------------------------------------
    async def update_item(self, ctx: RequestContext, item_id: uuid.UUID, data: dict[str, Any]) -> ContentItem:
        ctx.require("editor")
        item = await self.get_item(ctx, item_id)
        model = get_spec(item.content_type).payload_model
        try:
            validated = model.model_validate({**item.data, **data})
        except ValidationError as exc:
            raise ValidationFailed(
                "Some parts of this content are empty or invalid.",
                details={
                    "errors": [{"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()]
                },
            ) from None
        item.data = validated.model_dump(mode="json")
        item.is_edited = True
        await self.db.commit()
        return item

    # --- Queries ----------------------------------------------------------------
    async def get(self, ctx: RequestContext, generation_id: uuid.UUID) -> ContentGeneration:
        generation = await self.db.scalar(
            select(ContentGeneration)
            .options(selectinload(ContentGeneration.items))
            .where(ContentGeneration.id == generation_id, ContentGeneration.workspace_id == ctx.workspace.id)
            .execution_options(populate_existing=True)
        )
        if generation is None:
            raise NotFoundError(title="We couldn't find that generation")
        return generation

    async def get_item(self, ctx: RequestContext, item_id: uuid.UUID) -> ContentItem:
        item = await self.db.scalar(
            select(ContentItem)
            .options(selectinload(ContentItem.generation))
            .where(ContentItem.id == item_id, ContentItem.workspace_id == ctx.workspace.id)
        )
        if item is None:
            raise NotFoundError(title="We couldn't find that content")
        return item

    @staticmethod
    def _usage(
        ctx: RequestContext,
        generation: ContentGeneration,
        kind: str,
        tier: str,
        source: str,
        model: str,
        result: RoutedResult[Any] | None,
    ) -> UsageEvent:
        return UsageEvent(
            workspace_id=ctx.workspace.id,
            user_id=ctx.user.id,
            generation_id=generation.id,
            kind=kind,
            ai_source=source,
            provider=generation.provider or "",
            model=model or generation.model or "",
            tier=tier,
            input_tokens=result.input_tokens if result else 0,
            output_tokens=result.output_tokens if result else 0,
            succeeded=result is not None,
        )
