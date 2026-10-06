from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, Response

from app.api.deps import ContainerDep, ContextDep, DbDep, GenerationDep
from app.db.models import ContentGeneration, ContentItem
from app.schemas.common import Page
from app.schemas.generation import (
    ContentItemOut,
    GenerateRequest,
    GenerationMeta,
    GenerationOut,
    GenerationSummary,
    ItemUpdate,
    RegenerateFieldRequest,
)
from app.services.context import RequestContext
from app.services.library import HistoryService, LibraryService, brand_names

router = APIRouter(tags=["generation"])


def _summary(gen: ContentGeneration, brand_name: str, item_count: int) -> GenerationSummary:
    request = gen.request or {}
    return GenerationSummary(
        id=gen.id,
        brand_id=gen.brand_id,
        brand_name=brand_name or (gen.brand_snapshot or {}).get("name", ""),
        platform=gen.platform,
        content_type=gen.content_type,
        title=gen.title,
        topic=str(request.get("topic", "")),
        objective=str(request.get("objective", "")),
        quality_requested=gen.quality_requested,
        status=gen.status,
        item_count=item_count,
        created_at=gen.created_at,
    )


def _item_out(item: ContentItem, saved: dict[uuid.UUID, uuid.UUID]) -> ContentItemOut:
    out = ContentItemOut.model_validate(item)
    out.saved_id = saved.get(item.id)
    return out


async def _generation_out(ctx: RequestContext, db: DbDep, gen: ContentGeneration) -> GenerationOut:
    names = await brand_names(db, ctx)
    saved = await LibraryService(db).saved_ids_for_items(ctx, [i.id for i in gen.items])
    summary = _summary(gen, names.get(gen.brand_id, "") if gen.brand_id else "", len(gen.items))
    return GenerationOut(
        **summary.model_dump(),
        request=gen.request,
        items=[_item_out(i, saved) for i in gen.items],
        meta=GenerationMeta.model_validate(gen),
    )


@router.post("/generations", response_model=GenerationOut, status_code=201)
async def create_generation(
    payload: GenerateRequest, ctx: ContextDep, db: DbDep, c: ContainerDep, service: GenerationDep
) -> GenerationOut:
    c.rate_limiter.hit(f"generate:{ctx.workspace.id}", c.settings.generation_rate_limit_per_minute)
    generation = await service.generate(ctx, payload)
    return await _generation_out(ctx, db, generation)


@router.get("/generations", response_model=Page[GenerationSummary])
async def list_generations(
    ctx: ContextDep,
    db: DbDep,
    content_type: str | None = None,
    brand_id: uuid.UUID | None = None,
    q: str = Query(default="", max_length=200),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[GenerationSummary]:
    rows, total = await HistoryService(db).list(
        ctx, content_type=content_type, brand_id=brand_id, q=q, limit=limit, offset=offset
    )
    names = await brand_names(db, ctx)
    items = [_summary(gen, names.get(gen.brand_id, "") if gen.brand_id else "", n) for gen, n in rows]
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/generations/{generation_id}", response_model=GenerationOut)
async def get_generation(generation_id: uuid.UUID, ctx: ContextDep, db: DbDep, service: GenerationDep) -> GenerationOut:
    return await _generation_out(ctx, db, await service.get(ctx, generation_id))


@router.delete("/generations/{generation_id}", status_code=204)
async def delete_generation(generation_id: uuid.UUID, ctx: ContextDep, db: DbDep) -> Response:
    await HistoryService(db).delete(ctx, generation_id)
    return Response(status_code=204)


@router.patch("/items/{item_id}", response_model=ContentItemOut)
async def update_item(
    item_id: uuid.UUID, payload: ItemUpdate, ctx: ContextDep, db: DbDep, service: GenerationDep
) -> ContentItemOut:
    item = await service.update_item(ctx, item_id, payload.data)
    return _item_out(item, await LibraryService(db).saved_ids_for_items(ctx, [item.id]))


@router.post("/items/{item_id}/regenerate", response_model=ContentItemOut)
async def regenerate_field(
    item_id: uuid.UUID,
    payload: RegenerateFieldRequest,
    ctx: ContextDep,
    db: DbDep,
    c: ContainerDep,
    service: GenerationDep,
) -> ContentItemOut:
    c.rate_limiter.hit(f"generate:{ctx.workspace.id}", c.settings.generation_rate_limit_per_minute)
    item = await service.regenerate_field(ctx, item_id, payload.field, payload.instruction)
    return _item_out(item, await LibraryService(db).saved_ids_for_items(ctx, [item.id]))
