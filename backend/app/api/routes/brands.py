from __future__ import annotations

import uuid

from fastapi import APIRouter, Response

from app.api.deps import ContextDep, DbDep
from app.schemas.brands import BrandCreate, BrandOut, BrandUpdate
from app.services.brands import BrandService

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("", response_model=list[BrandOut])
async def list_brands(ctx: ContextDep, db: DbDep) -> list[BrandOut]:
    return [BrandService.to_out(b, ctx.workspace.active_brand_id) for b in await BrandService(db).list(ctx)]


@router.post("", response_model=BrandOut, status_code=201)
async def create_brand(payload: BrandCreate, ctx: ContextDep, db: DbDep) -> BrandOut:
    brand = await BrandService(db).create(ctx, payload)
    return BrandService.to_out(brand, ctx.workspace.active_brand_id)


@router.get("/{brand_id}", response_model=BrandOut)
async def get_brand(brand_id: uuid.UUID, ctx: ContextDep, db: DbDep) -> BrandOut:
    return BrandService.to_out(await BrandService(db).get(ctx, brand_id), ctx.workspace.active_brand_id)


@router.patch("/{brand_id}", response_model=BrandOut)
async def update_brand(brand_id: uuid.UUID, payload: BrandUpdate, ctx: ContextDep, db: DbDep) -> BrandOut:
    brand = await BrandService(db).update(ctx, brand_id, payload)
    return BrandService.to_out(brand, ctx.workspace.active_brand_id)


@router.post("/{brand_id}/activate", response_model=BrandOut)
async def activate_brand(brand_id: uuid.UUID, ctx: ContextDep, db: DbDep) -> BrandOut:
    service = BrandService(db)
    await service.set_active(ctx, brand_id)
    return BrandService.to_out(await service.get(ctx, brand_id), ctx.workspace.active_brand_id)


@router.delete("/{brand_id}", status_code=204)
async def delete_brand(brand_id: uuid.UUID, ctx: ContextDep, db: DbDep) -> Response:
    await BrandService(db).archive(ctx, brand_id)
    return Response(status_code=204)
