/**
 * GET /api/player/showcase-listings?warehouseBuildingId=...&marketZone=...
 * POST /api/player/showcase-listings - create/update listing from inventory
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { BuildingRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst({
      where: { playerId: session.user.id },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const warehouseBuildingId = searchParams.get('warehouseBuildingId') ?? undefined;
    const marketZone = searchParams.get('marketZone') ?? undefined;

    const listings = await prisma.showcaseListing.findMany({
      where: {
        companyId: company.id,
        ...(warehouseBuildingId && { warehouseBuildingId }),
        ...(marketZone && { marketZone: marketZone as any }),
        status: 'LISTED',
      },
      select: {
        id: true,
        marketZone: true,
        warehouseBuildingId: true,
        playerProductId: true,
        productTemplateId: true,
        salePrice: true,
        listPrice: true,
        isFeatured: true,
        status: true,
        pausedReason: true,
        productTemplate: { select: { name: true, code: true } },
      },
    });

    return NextResponse.json({
      listings: listings.map((l) => ({
        id: l.id,
        marketZone: l.marketZone,
        warehouseBuildingId: l.warehouseBuildingId,
        playerProductId: l.playerProductId,
        productTemplateId: l.productTemplateId,
        salePrice: l.salePrice.toString(),
        listPrice: l.listPrice?.toString() ?? null,
        isFeatured: l.isFeatured,
        status: l.status,
        pausedReason: l.pausedReason,
        productName: l.productTemplate?.name ?? l.productTemplateId,
        productCode: l.productTemplate?.code,
      })),
    });
  } catch (e) {
    console.error('[showcase-listings GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load listings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst({
      where: { playerId: session.user.id },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      warehouseBuildingId,
      inventoryItemId,
      salePrice,
      listPrice,
      isFeatured,
    } = body as {
      warehouseBuildingId?: string;
      inventoryItemId?: string;
      salePrice?: string | number;
      listPrice?: string | number;
      isFeatured?: boolean;
    };

    if (!warehouseBuildingId || !inventoryItemId || salePrice === undefined) {
      return NextResponse.json(
        { error: 'warehouseBuildingId, inventoryItemId, and salePrice are required' },
        { status: 400 }
      );
    }

    const warehouse = await prisma.companyBuilding.findFirst({
      where: {
        id: warehouseBuildingId,
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
      },
      select: { id: true, marketZone: true },
    });
    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found or does not belong to your company' },
        { status: 404 }
      );
    }
    const marketZone = warehouse.marketZone;
    if (marketZone == null) {
      return NextResponse.json(
        { error: 'Warehouse must have a marketZone set' },
        { status: 400 }
      );
    }

    const inventoryItem = await prisma.buildingInventoryItem.findFirst({
      where: {
        id: inventoryItemId,
        companyBuildingId: warehouseBuildingId,
      },
      include: {
        companyBuilding: { select: { companyId: true } },
      },
    });

    if (!inventoryItem || inventoryItem.companyBuilding.companyId !== company.id) {
      return NextResponse.json(
        { error: 'Inventory item not found or does not belong to this warehouse' },
        { status: 404 }
      );
    }

    if (inventoryItem.qtyOnHand <= 0) {
      return NextResponse.json(
        { error: 'Cannot list: qtyOnHand is 0' },
        { status: 400 }
      );
    }

    if (!inventoryItem.playerProductId) {
      return NextResponse.json(
        { error: 'Inventory item has no playerProductId; cannot list yet.' },
        { status: 400 }
      );
    }

    const salePriceDec = new Decimal(salePrice.toString());
    const listPriceDec = listPrice != null ? new Decimal(listPrice.toString()) : null;
    const dayKey = await getCompanyGameDayKey(company.id);

    const listing = await prisma.showcaseListing.upsert({
      where: {
        companyId_marketZone_playerProductId: {
          companyId: company.id,
          marketZone,
          playerProductId: inventoryItem.playerProductId,
        },
      },
      create: {
        companyId: company.id,
        marketZone,
        warehouseBuildingId,
        playerProductId: inventoryItem.playerProductId,
        productTemplateId: inventoryItem.productTemplateId,
        salePrice: salePriceDec,
        listPrice: listPriceDec ?? undefined,
        isFeatured: isFeatured ?? false,
        status: 'LISTED',
        pausedReason: 'NONE',
        pausedAt: null,
        launchedAtDayKey: dayKey,
      },
      update: {
        warehouseBuildingId,
        marketZone,
        salePrice: salePriceDec,
        listPrice: listPriceDec ?? undefined,
        isFeatured: isFeatured ?? false,
        status: 'LISTED',
        pausedReason: 'NONE',
        pausedAt: null,
      },
    });

    return NextResponse.json({
      id: listing.id,
      companyId: listing.companyId,
      marketZone: listing.marketZone,
      warehouseBuildingId: listing.warehouseBuildingId,
      playerProductId: listing.playerProductId,
      productTemplateId: listing.productTemplateId,
      salePrice: listing.salePrice.toString(),
      listPrice: listing.listPrice?.toString() ?? null,
      isFeatured: listing.isFeatured,
      status: listing.status,
      launchedAtDayKey: listing.launchedAtDayKey?.toISOString?.() ?? null,
    });
  } catch (e) {
    console.error('[showcase-listings POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create listing' },
      { status: 500 }
    );
  }
}
