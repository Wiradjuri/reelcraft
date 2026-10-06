"""Content library (saved content) and generation history queries."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.content.registry import get_spec
from app.core.errors import NotFoundError, ValidationFailed
from app.db.models import BrandProfile, ContentGeneration, ContentItem, SavedContent
from app.schemas.library import SavedUpdate, SaveItemRequest
from app.services.context import RequestContext


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def brand_names(db: AsyncSession, ctx: RequestContext) -> dict[uuid.UUID, str]:
    rows = await db.execute(
        select(BrandProfile.id, BrandProfile.name).where(BrandProfile.workspace_id == ctx.workspace.id)
    )
    return {row.id: row.name for row in rows}


class LibraryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def save_item(self, ctx: RequestContext, payload: SaveItemRequest) -> SavedContent:
        ctx.require("editor")
        item = await self.db.scalar(
            select(ContentItem)
            .options(selectinload(ContentItem.generation))
            .where(ContentItem.id == payload.item_id, ContentItem.workspace_id == ctx.workspace.id)
        )
        if item is None:
            raise NotFoundError(title="We couldn't find that content")
        existing = await self.db.scalar(
            select(SavedContent).where(SavedContent.item_id == item.id, SavedContent.workspace_id == ctx.workspace.id)
        )
        generation = item.generation
        title = payload.title or get_spec(item.content_type).title_for(item.data) or generation.title or "Untitled"
        request = generation.request or {}
        context = {
            "topic": request.get("topic", ""),
            "objective": request.get("objective", ""),
            "tone": request.get("tone", ""),
            "angle": item.angle,
            "options": request.get("options", {}),
            "brand_name": (generation.brand_snapshot or {}).get("name", ""),
            "generated_at": generation.created_at.isoformat(),
        }
        if existing is not None:
            # Saving again refreshes the snapshot with the latest edits.
            existing.data = dict(item.data)
            existing.title = title[:200]
            existing.tags = payload.tags or existing.tags
            existing.is_favourite = existing.is_favourite or payload.is_favourite
            saved = existing
        else:
            saved = SavedContent(
                workspace_id=ctx.workspace.id,
                brand_id=generation.brand_id,
                item_id=item.id,
                generation_id=generation.id,
                created_by_id=ctx.user.id,
                platform=generation.platform,
                content_type=item.content_type,
                title=title[:200],
                data=dict(item.data),
                generation_context=context,
                tags=payload.tags,
                is_favourite=payload.is_favourite,
            )
            self.db.add(saved)
        await self.db.commit()
        return saved

    async def get(self, ctx: RequestContext, saved_id: uuid.UUID) -> SavedContent:
        saved = await self.db.scalar(
            select(SavedContent).where(SavedContent.id == saved_id, SavedContent.workspace_id == ctx.workspace.id)
        )
        if saved is None:
            raise NotFoundError(title="We couldn't find that saved content")
        return saved

    async def update(self, ctx: RequestContext, saved_id: uuid.UUID, payload: SavedUpdate) -> SavedContent:
        ctx.require("editor")
        saved = await self.get(ctx, saved_id)
        changes = payload.model_dump(exclude_unset=True)
        if (data := changes.pop("data", None)) is not None:
            try:
                saved.data = (
                    get_spec(saved.content_type)
                    .payload_model.model_validate({**saved.data, **data})
                    .model_dump(mode="json")
                )
            except ValidationError:
                raise ValidationFailed("Some parts of this content are empty or invalid.") from None
        for key, value in changes.items():
            if value is not None:
                setattr(saved, key, value)
        await self.db.commit()
        return saved

    async def delete(self, ctx: RequestContext, saved_id: uuid.UUID) -> None:
        ctx.require("editor")
        await self.db.delete(await self.get(ctx, saved_id))
        await self.db.commit()

    async def search(
        self,
        ctx: RequestContext,
        *,
        q: str = "",
        content_type: str | None = None,
        brand_id: uuid.UUID | None = None,
        favourites: bool = False,
        tag: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 24,
        offset: int = 0,
    ) -> tuple[list[SavedContent], int]:
        stmt: Select[Any] = select(SavedContent).where(SavedContent.workspace_id == ctx.workspace.id)
        if q.strip():
            term = f"%{_escape_like(q.strip().lower())}%"
            # Title/notes search; payload text search can move to PostgreSQL full-text later.
            stmt = stmt.where(
                or_(
                    func.lower(SavedContent.title).like(term, escape="\\"),
                    func.lower(SavedContent.notes).like(term, escape="\\"),
                )
            )
        if content_type:
            stmt = stmt.where(SavedContent.content_type == content_type)
        if brand_id:
            stmt = stmt.where(SavedContent.brand_id == brand_id)
        if favourites:
            stmt = stmt.where(SavedContent.is_favourite.is_(True))
        if date_from:
            stmt = stmt.where(SavedContent.created_at >= date_from)
        if date_to:
            stmt = stmt.where(SavedContent.created_at <= date_to)
        stmt = stmt.order_by(SavedContent.created_at.desc())
        if tag:
            # Tags are JSON; filter in Python to stay database-agnostic. (A JSONB containment
            # query or a tags table is the upgrade path for very large libraries.)
            rows = [r for r in await self.db.scalars(stmt) if tag.lower() in {t.lower() for t in r.tags or []}]
            return rows[offset : offset + limit], len(rows)
        total = int(await self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
        return list(await self.db.scalars(stmt.limit(limit).offset(offset))), total

    async def all_tags(self, ctx: RequestContext) -> list[str]:
        rows = await self.db.scalars(select(SavedContent.tags).where(SavedContent.workspace_id == ctx.workspace.id))
        return sorted({tag for tags in rows for tag in (tags or [])}, key=str.lower)

    async def saved_ids_for_items(self, ctx: RequestContext, item_ids: list[uuid.UUID]) -> dict[uuid.UUID, uuid.UUID]:
        if not item_ids:
            return {}
        rows = await self.db.execute(
            select(SavedContent.item_id, SavedContent.id).where(
                SavedContent.workspace_id == ctx.workspace.id, SavedContent.item_id.in_(item_ids)
            )
        )
        return {row.item_id: row.id for row in rows if row.item_id}


class HistoryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        ctx: RequestContext,
        *,
        content_type: str | None = None,
        brand_id: uuid.UUID | None = None,
        q: str = "",
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[tuple[ContentGeneration, int]], int]:
        base = select(ContentGeneration).where(ContentGeneration.workspace_id == ctx.workspace.id)
        if content_type:
            base = base.where(ContentGeneration.content_type == content_type)
        if brand_id:
            base = base.where(ContentGeneration.brand_id == brand_id)
        if q.strip():
            base = base.where(
                func.lower(ContentGeneration.title).like(f"%{_escape_like(q.strip().lower())}%", escape="\\")
            )
        total = int(await self.db.scalar(select(func.count()).select_from(base.subquery())) or 0)
        counts = (
            select(ContentItem.generation_id, func.count(ContentItem.id).label("n"))
            .group_by(ContentItem.generation_id)
            .subquery()
        )
        stmt = (
            base.add_columns(func.coalesce(counts.c.n, 0))
            .outerjoin(counts, counts.c.generation_id == ContentGeneration.id)
            .order_by(ContentGeneration.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.db.execute(stmt)).all()
        return [(row[0], int(row[1])) for row in rows], total

    async def delete(self, ctx: RequestContext, generation_id: uuid.UUID) -> None:
        ctx.require("editor")
        generation = await self.db.scalar(
            select(ContentGeneration).where(
                ContentGeneration.id == generation_id, ContentGeneration.workspace_id == ctx.workspace.id
            )
        )
        if generation is None:
            raise NotFoundError()
        await self.db.delete(generation)
        await self.db.commit()

    async def stats(self, ctx: RequestContext) -> dict[str, int]:
        ws = ctx.workspace.id
        generations = await self.db.scalar(
            select(func.count())
            .select_from(ContentGeneration)
            .where(ContentGeneration.workspace_id == ws, ContentGeneration.status == "succeeded")
        )
        items = await self.db.scalar(
            select(func.count()).select_from(ContentItem).where(ContentItem.workspace_id == ws)
        )
        saved = await self.db.scalar(
            select(func.count()).select_from(SavedContent).where(SavedContent.workspace_id == ws)
        )
        favourites = await self.db.scalar(
            select(func.count())
            .select_from(SavedContent)
            .where(SavedContent.workspace_id == ws, SavedContent.is_favourite.is_(True))
        )
        return {
            "generations": int(generations or 0),
            "pieces_created": int(items or 0),
            "saved": int(saved or 0),
            "favourites": int(favourites or 0),
        }
