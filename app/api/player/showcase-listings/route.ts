// app/api/player/showcase-listings/route.ts

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
import { getPriceMultiplier } from '@/lib/game/price-index';
import { CategoryLevel } from '@prisma/client';
import type { PrismaClient, Prisma } from '@prisma/client';

type BandResult = {
  bandConfigId: string | null;
  baseMinDaily: number;
  baseMaxDaily: number;
  boostSnapshot: Record<string, unknown>;
};

async function resolveBand(
  client: PrismaClient,
  categoryL3Id: string,
  productQuality: string,
  tierUsed: number
): Promise<BandResult> {
  const tierClamped = Math.min(5, Math.max(1, tierUsed));
  const bandAtL3 = await client.productSalesBandConfig.findFirst({
    where: {
      categoryL3Id,
      productQuality: productQuality as 'STANDARD' | 'PREMIUM' | 'LUXURY',
      isActive: true,
      tierMin: { lte: tierClamped },
      tierMax: { gte: tierClamped },
    },
    select: { id: true, minDaily: true, maxDaily: true },
  });
  if (bandAtL3) {
    return {
      bandConfigId: bandAtL3.id,
      baseMinDaily: bandAtL3.minDaily,
      baseMaxDaily: bandAtL3.maxDaily,
      boostSnapshot: {},
    };
  }
  const node = await client.productCategoryNode.findUnique({
    where: { id: categoryL3Id },
    select: { level: true, parentId: true },
  });
  if (node?.level === CategoryLevel.L3 && node.parentId) {
    const bandAtL2 = await client.productSalesBandConfig.findFirst({
      where: {
        categoryL3Id: node.parentId,
        productQuality: productQuality as 'STANDARD' | 'PREMIUM' | 'LUXURY',
        isActive: true,
        tierMin: { lte: tierClamped },
        tierMax: { gte: tierClamped },
      },
      select: { id: true, minDaily: true, maxDaily: true },
    });
    if (bandAtL2) {
      return {
        bandConfigId: bandAtL2.id,
        baseMinDaily: bandAtL2.minDaily,
        baseMaxDaily: bandAtL2.maxDaily,
        boostSnapshot: {},
      };
    }
  }
  // Correction A: fallback when no band config (do not block player)
  const baseMaxDaily = Math.max(2, Math.min(5, tierClamped + 1));
  return {
    bandConfigId: null,
    baseMinDaily: 1,
    baseMaxDaily,
    boostSnapshot: {
      missingBand: true,
      missingBandTier: tierClamped,
      missingBandCategoryId: node?.parentId ?? categoryL3Id,
    },
  };
}

type PriceSnapshot = {
  normalPrice: Decimal;
  priceIndex: number;
  priceMultiplier: number;
  blockedByPrice: boolean;
};

/** Clamp band min/max so baseMinDaily is never 0 and baseMaxDaily >= baseMinDaily. */
function clampBandForSnapshot(baseMinDaily: number, baseMaxDaily: number): { baseMinDaily: number; baseMaxDaily: number } {
  const baseMinDailyClamped = Math.max(1, baseMinDaily);
  const baseMaxDailyClamped = Math.max(baseMinDailyClamped, baseMaxDaily);
  return { baseMinDaily: baseMinDailyClamped, baseMaxDaily: baseMaxDailyClamped };
}

function computePriceSnapshot(
  salePriceNum: number,
  suggestedSalePrice: number | null,
  multiplier: number
): PriceSnapshot {
  let normalPriceNum = suggestedSalePrice != null ? Number(suggestedSalePrice) * multiplier : salePriceNum;
  if (normalPriceNum <= 0 || !Number.isFinite(normalPriceNum)) {
    normalPriceNum = salePriceNum;
  }
  if (normalPriceNum <= 0) {
    normalPriceNum = salePriceNum;
  }
  let priceIndex = normalPriceNum > 0 ? salePriceNum / normalPriceNum : 1;
  if (!Number.isFinite(priceIndex) || priceIndex <= 0) {
    priceIndex = 1;
  }
  const priceMultiplier = getPriceMultiplier(priceIndex);
  const blockedByPrice = priceMultiplier === 0;
  return {
    normalPrice: new Decimal(normalPriceNum.toFixed(2)),
    priceIndex,
    priceMultiplier,
    blockedByPrice,
  };
}

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

    let inventoryItemIdByPlayerProductId: Record<string, string> = {};
    if (warehouseBuildingId && listings.length > 0) {
      const playerProductIds = [...new Set(listings.map((l) => l.playerProductId))];
      const inventoryItems = await prisma.buildingInventoryItem.findMany({
        where: {
          companyBuildingId: warehouseBuildingId,
          playerProductId: { in: playerProductIds },
        },
        select: { id: true, playerProductId: true },
      });
      inventoryItemIdByPlayerProductId = Object.fromEntries(
        inventoryItems
          .filter((i) => i.playerProductId != null)
          .map((i) => [i.playerProductId!, i.id])
      );
    }

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
        inventoryItemId: inventoryItemIdByPlayerProductId[l.playerProductId] ?? null,
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

    const template = await prisma.productTemplate.findUnique({
      where: { id: inventoryItem.productTemplateId },
      select: {
        suggestedSalePrice: true,
        categoryL3Id: true,
        productQuality: true,
        seasonScenarioDefinitionId: true,
      },
    });
    if (!template) {
      return NextResponse.json(
        { error: 'Product template not found' },
        { status: 404 }
      );
    }

    const whereUnique = {
      companyId_marketZone_playerProductId: {
        companyId: company.id,
        marketZone,
        playerProductId: inventoryItem.playerProductId,
      },
    };
    const existingListing = await prisma.showcaseListing.findUnique({
      where: whereUnique,
      select: { id: true, boostSnapshot: true },
    });

    const priceIndexRow = await prisma.marketZonePriceIndex.findUnique({
      where: { marketZone },
      select: { multiplier: true, isActive: true },
    });
    const multiplier =
      priceIndexRow?.isActive && priceIndexRow.multiplier != null
        ? Number(priceIndexRow.multiplier)
        : 1;
    const suggestedNum =
      template.suggestedSalePrice != null ? Number(template.suggestedSalePrice) : 0;
    const salePriceNum = Number(salePrice);
    const priceSnapshot = computePriceSnapshot(salePriceNum, suggestedNum || null, multiplier);

    const salePriceDec = new Decimal(salePrice.toString());
    const listPriceDec = listPrice != null ? new Decimal(listPrice.toString()) : null;

    const priceOnlyUpdate = {
      warehouseBuildingId,
      marketZone,
      salePrice: salePriceDec,
      listPrice: listPriceDec ?? undefined,
      isFeatured: isFeatured ?? false,
      status: 'LISTED' as const,
      pausedReason: 'NONE' as const,
      pausedAt: null,
      normalPrice: priceSnapshot.normalPrice,
      priceIndex: priceSnapshot.priceIndex,
      priceMultiplier: priceSnapshot.priceMultiplier,
      blockedByPrice: priceSnapshot.blockedByPrice,
    };

    let listing: Awaited<ReturnType<typeof prisma.showcaseListing.update>>;

    if (existingListing) {
      // UPDATE: preserve base snapshot; update price snapshot and listing fields only.
      listing = await prisma.showcaseListing.update({
        where: whereUnique,
        data: priceOnlyUpdate,
      });
    } else {
      // CREATE: resolve band, clamp min/max, generate baseQty once, write full snapshot.
      const metricState = await prisma.buildingMetricState.findUnique({
        where: {
          buildingId_metricType: {
            buildingId: warehouseBuildingId,
            metricType: 'SALES_COUNT',
          },
        },
        select: { currentLevel: true },
      });
      const tierUsed = Math.min(5, Math.max(1, metricState?.currentLevel ?? 1));

      const band = await resolveBand(
        prisma,
        template.categoryL3Id,
        template.productQuality,
        tierUsed
      );
      const { baseMinDaily, baseMaxDaily } = clampBandForSnapshot(
        band.baseMinDaily,
        band.baseMaxDaily
      );

      const baseQty =
        baseMaxDaily >= baseMinDaily
          ? baseMinDaily +
            Math.floor(Math.random() * (baseMaxDaily - baseMinDaily + 1))
          : baseMinDaily;

      const dayKey = await getCompanyGameDayKey(company.id);

      const boostSnapshotForCreate: Record<string, unknown> = {
        ...band.boostSnapshot,
        initialPositiveBoostPct: 0,
        initialNegativeBoostPct: 0,
      };

      listing = await prisma.showcaseListing.create({
        data: {
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
          tierUsed,
          bandConfigId: band.bandConfigId,
          baseMinDaily,
          baseMaxDaily,
          baseQty,
          normalPrice: priceSnapshot.normalPrice,
          priceIndex: priceSnapshot.priceIndex,
          priceMultiplier: priceSnapshot.priceMultiplier,
          blockedByPrice: priceSnapshot.blockedByPrice,
          seasonScore: null,
          blockedBySeason: false,
          positiveBoostPct: 0,
          negativeBoostPct: 0,
          boostSnapshot: boostSnapshotForCreate as Prisma.InputJsonValue,
        },
      });
    }

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
      baseQty: listing.baseQty,
      tierUsed: listing.tierUsed,
      baseMinDaily: listing.baseMinDaily,
      baseMaxDaily: listing.baseMaxDaily,
      priceIndex: listing.priceIndex,
      priceMultiplier: listing.priceMultiplier,
      blockedByPrice: listing.blockedByPrice,
    });
  } catch (e) {
    console.error('[showcase-listings POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create listing' },
      { status: 500 }
    );
  }
}
