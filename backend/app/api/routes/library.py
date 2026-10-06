from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Query, Response

from app.api.deps import ContextDep, DbDep
from app.db.models import SavedContent
from app.schemas.common import Page
from app.schemas.library import SavedOut, SavedUpdate, SaveItemRequest
from app.services.library import LibraryService, brand_names

router = APIRouter(prefix="/library", tags=["library"])


def _out(saved: SavedContent, names: dict[uuid.UUID, str]) -> SavedOut:
    out = SavedOut.model_validate(saved)
    out.brand_name = (names.get(saved.brand_id, "") if saved.brand_id else "") or str(
        saved.generation_context.get("brand_name", "")
    )
    return out


@router.post("", response_model=SavedOut, status_code=201)
async def save_item(payload: SaveItemRequest, ctx: ContextDep, db: DbDep) -> SavedOut:
    saved = await LibraryService(db).save_item(ctx, payload)
    return _out(saved, await brand_names(db, ctx))


@router.get("", response_model=Page[SavedOut])
async def search_library(
    ctx: ContextDep,
    db: DbDep,
    q: str = Query(default="", max_length=200),
    content_type: str | None = None,
    brand_id: uuid.UUID | None = None,
    favourites: bool = False,
    tag: str | None = Query(default=None, max_length=120),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[SavedOut]:
    rows, total = await LibraryService(db).search(
        ctx,
        q=q,
        content_type=content_type,
        brand_id=brand_id,
        favourites=favourites,
        tag=tag,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    names = await brand_names(db, ctx)
    return Page(items=[_out(r, names) for r in rows], total=total, limit=limit, offset=offset)


@router.get("/tags", response_model=list[str])
async def library_tags(ctx: ContextDep, db: DbDep) -> list[str]:
    return await LibraryService(db).all_tags(ctx)


@router.get("/{saved_id}", response_model=SavedOut)
async def get_saved(saved_id: uuid.UUID, ctx: ContextDep, db: DbDep) -> SavedOut:
    return _out(await LibraryService(db).get(ctx, saved_id), await brand_names(db, ctx))


@router.patch("/{saved_id}", response_model=SavedOut)
async def update_saved(saved_id: uuid.UUID, payload: SavedUpdate, ctx: ContextDep, db: DbDep) -> SavedOut:
    return _out(await LibraryService(db).update(ctx, saved_id, payload), await brand_names(db, ctx))


@router.delete("/{saved_id}", status_code=204)
async def delete_saved(saved_id: uuid.UUID, ctx: ContextDep, db: DbDep) -> Response:
    await LibraryService(db).delete(ctx, saved_id)
    return Response(status_code=204)
