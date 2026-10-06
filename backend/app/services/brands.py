"""Brand profile management."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.base import utcnow
from app.db.models import BrandProfile
from app.schemas.brands import BrandCreate, BrandOut, BrandUpdate
from app.services.context import RequestContext


class BrandService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self, ctx: RequestContext) -> list[BrandProfile]:
        result = await self.db.scalars(
            select(BrandProfile)
            .where(BrandProfile.workspace_id == ctx.workspace.id, BrandProfile.archived_at.is_(None))
            .order_by(BrandProfile.created_at)
        )
        return list(result)

    async def get(self, ctx: RequestContext, brand_id: uuid.UUID) -> BrandProfile:
        brand = await self.db.scalar(
            select(BrandProfile).where(
                BrandProfile.id == brand_id,
                BrandProfile.workspace_id == ctx.workspace.id,
                BrandProfile.archived_at.is_(None),
            )
        )
        if brand is None:
            raise NotFoundError(title="We couldn't find that brand")
        return brand

    async def resolve(self, ctx: RequestContext, brand_id: uuid.UUID | None) -> BrandProfile:
        """The requested brand, else the active brand, else the first brand."""
        if brand_id is not None:
            return await self.get(ctx, brand_id)
        if ctx.workspace.active_brand_id is not None:
            try:
                return await self.get(ctx, ctx.workspace.active_brand_id)
            except NotFoundError:
                pass
        brands = await self.list(ctx)
        if not brands:
            raise NotFoundError(
                "Create a brand profile first so we can tailor content to your business.",
                title="Add your brand first",
                code="brand_required",
            )
        return brands[0]

    async def create(self, ctx: RequestContext, payload: BrandCreate) -> BrandProfile:
        ctx.require("editor")
        brand = BrandProfile(workspace_id=ctx.workspace.id, **payload.model_dump(exclude={"make_active"}))
        self.db.add(brand)
        await self.db.flush()
        if payload.make_active or ctx.workspace.active_brand_id is None:
            ctx.workspace.active_brand_id = brand.id
        await self.db.commit()
        return brand

    async def update(self, ctx: RequestContext, brand_id: uuid.UUID, payload: BrandUpdate) -> BrandProfile:
        ctx.require("editor")
        brand = await self.get(ctx, brand_id)
        for key, value in payload.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(brand, key, value)
        await self.db.commit()
        return brand

    async def archive(self, ctx: RequestContext, brand_id: uuid.UUID) -> None:
        """Soft-delete so history and library entries keep their context."""
        ctx.require("admin")
        brand = await self.get(ctx, brand_id)
        brand.archived_at = utcnow()
        if ctx.workspace.active_brand_id == brand.id:
            remaining = [b for b in await self.list(ctx) if b.id != brand.id]
            ctx.workspace.active_brand_id = remaining[0].id if remaining else None
        await self.db.commit()

    async def set_active(self, ctx: RequestContext, brand_id: uuid.UUID) -> None:
        brand = await self.get(ctx, brand_id)
        ctx.workspace.active_brand_id = brand.id
        await self.db.commit()

    async def count(self, ctx: RequestContext) -> int:
        return int(
            await self.db.scalar(
                select(func.count())
                .select_from(BrandProfile)
                .where(BrandProfile.workspace_id == ctx.workspace.id, BrandProfile.archived_at.is_(None))
            )
            or 0
        )

    @staticmethod
    def to_out(brand: BrandProfile, active_id: uuid.UUID | None) -> BrandOut:
        out = BrandOut.model_validate(brand)
        out.is_active = brand.id == active_id
        return out
