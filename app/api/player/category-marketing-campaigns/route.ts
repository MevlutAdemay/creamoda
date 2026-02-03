/**
 * GET /api/player/category-marketing-campaigns?warehouseBuildingId=...
 * POST /api/player/category-marketing-campaigns - create campaign (packageId, ledger + wallet)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { BuildingRole, CategoryLevel } from '@prisma/client';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';
import {
  getPackage,
  getCategorySkuCount,
  getPricingMultiplier,
  computeTotalPrice,
} from '@/lib/marketing/campaign-cost';
import { postLedgerEntryAndUpdateWallet } from '@/lib/finance/helpers';
import { FinanceDirection, FinanceCategory, FinanceScopeType, FinanceCounterpartyType } from '@prisma/client';
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

    const campaigns = await (prisma as any).categoryMarketingCampaign.findMany({
      where: {
        companyId: company.id,
        ...(warehouseBuildingId && { warehouseBuildingId }),
      },
      orderBy: { startDayKey: 'desc' },
      select: {
        id: true,
        warehouseBuildingId: true,
        categoryNodeId: true,
        categoryNode: { select: { name: true } },
        startDayKey: true,
        endDayKey: true,
        positiveBoostPct: true,
        negativeBoostPct: true,
        title: true,
        status: true,
        packageKeySnapshot: true,
        totalPriceSnapshot: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      campaigns: campaigns.map(
        (c: {
          categoryNode?: { name: string };
          startDayKey: Date;
          endDayKey: Date;
          totalPriceSnapshot: unknown;
          createdAt: Date;
          [k: string]: unknown;
        }) => ({
          id: c.id,
          warehouseBuildingId: c.warehouseBuildingId,
          categoryNodeId: c.categoryNodeId,
          categoryName: c.categoryNode?.name ?? null,
          startDayKey: c.startDayKey.toISOString?.() ?? c.startDayKey,
          endDayKey: c.endDayKey.toISOString?.() ?? c.endDayKey,
          positiveBoostPct: c.positiveBoostPct,
          negativeBoostPct: c.negativeBoostPct,
          title: c.title,
          status: c.status,
          packageKeySnapshot: c.packageKeySnapshot,
          totalPriceSnapshot: c.totalPriceSnapshot?.toString?.() ?? c.totalPriceSnapshot,
          createdAt: c.createdAt.toISOString?.() ?? c.createdAt,
        })
      ),
    });
  } catch (e) {
    console.error('[category-marketing-campaigns GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load campaigns' },
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

    const userId = session.user.id;

    const company = await prisma.company.findFirst({
      where: { playerId: userId },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const body = await request.json();
    const { warehouseBuildingId, categoryNodeId, packageId, title, notes } = body as {
      warehouseBuildingId?: string;
      categoryNodeId?: string;
      packageId?: string;
      title?: string;
      notes?: string;
    };

    if (!warehouseBuildingId) {
      return NextResponse.json({ error: 'warehouseBuildingId is required' }, { status: 400 });
    }
    if (!categoryNodeId) {
      return NextResponse.json({ error: 'categoryNodeId is required' }, { status: 400 });
    }
    if (!packageId) {
      return NextResponse.json({ error: 'packageId is required' }, { status: 400 });
    }

    const warehouse = await prisma.companyBuilding.findFirst({
      where: {
        id: warehouseBuildingId,
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
      },
      select: { id: true },
    });
    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found or does not belong to your company' },
        { status: 404 }
      );
    }

    const categoryNode = await prisma.productCategoryNode.findUnique({
      where: { id: categoryNodeId, isActive: true },
      select: { id: true, level: true },
    });
    if (!categoryNode || categoryNode.level !== CategoryLevel.L2) {
      return NextResponse.json(
        { error: 'categoryNodeId must be an active L2 category node' },
        { status: 400 }
      );
    }

    const pkg = await getPackage(prisma, packageId, 'CATEGORY');

    const startDayKey = normalizeUtcMidnight(await getCompanyGameDayKey(company.id));
    const endDayKey = new Date(startDayKey);
    endDayKey.setUTCDate(endDayKey.getUTCDate() + pkg.durationDays - 1);
    const endDayKeyNorm = normalizeUtcMidnight(endDayKey);

    const overlapping = await (prisma as any).categoryMarketingCampaign.findFirst({
      where: {
        companyId: company.id,
        warehouseBuildingId,
        categoryNodeId,
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        startDayKey: { lte: endDayKeyNorm },
        endDayKey: { gte: startDayKey },
      },
      select: { id: true },
    });
    if (overlapping) {
      return NextResponse.json(
        { error: 'A campaign already exists for this category in the selected period.' },
        { status: 409 }
      );
    }

    const skuCount = await getCategorySkuCount(prisma, company.id, warehouseBuildingId, categoryNodeId);
    const multiplierStr = await getPricingMultiplier(prisma, 'CATEGORY', skuCount);
    const totalPrice = computeTotalPrice(pkg.priceUsd, multiplierStr);

    const wallet = await prisma.playerWallet.findUnique({
      where: { userId },
      select: { balanceUsd: true },
    });
    const balanceUsd = wallet?.balanceUsd ?? new Decimal(0);
    if (balanceUsd.lessThan(totalPrice)) {
      return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const campaign = await (tx as any).categoryMarketingCampaign.create({
          data: {
            companyId: company.id,
            warehouseBuildingId,
            categoryNodeId,
            startDayKey,
            endDayKey: endDayKeyNorm,
            positiveBoostPct: pkg.positiveBoostPct,
            negativeBoostPct: pkg.negativeBoostPct,
            title: title ?? null,
            notes: notes ?? null,
            status: 'SCHEDULED',
            packageId: pkg.id,
            packageKeySnapshot: pkg.key,
            packagePriceSnapshot: pkg.priceUsd,
            skuCountSnapshot: skuCount,
            skuPriceMultiplier: multiplierStr,
            totalPriceSnapshot: totalPrice,
          },
          select: {
            id: true,
            warehouseBuildingId: true,
            categoryNodeId: true,
            categoryNode: { select: { name: true } },
            startDayKey: true,
            endDayKey: true,
            positiveBoostPct: true,
            negativeBoostPct: true,
            title: true,
            status: true,
            packageKeySnapshot: true,
            totalPriceSnapshot: true,
            createdAt: true,
          },
        });

        const idempotencyKey = `MKT:CATEGORY:${campaign.id}`;
        await postLedgerEntryAndUpdateWallet(tx, userId, {
          companyId: company.id,
          dayKey: startDayKey,
          direction: FinanceDirection.OUT,
          amountUsd: totalPrice,
          category: FinanceCategory.MARKETING,
          scopeType: FinanceScopeType.BUILDING,
          scopeId: warehouseBuildingId,
          counterpartyType: FinanceCounterpartyType.SYSTEM,
          counterpartyId: null,
          refType: 'MARKETING_CAMPAIGN',
          refId: campaign.id,
          idempotencyKey,
          note: `Category campaign ${pkg.key} SKU ${skuCount}`,
        });

        return { campaign, totalPrice };
      },
      { timeout: 10000 }
    );

    return NextResponse.json({
      id: result.campaign.id,
      warehouseBuildingId: result.campaign.warehouseBuildingId,
      categoryNodeId: result.campaign.categoryNodeId,
      categoryName: result.campaign.categoryNode?.name ?? null,
      startDayKey: result.campaign.startDayKey.toISOString?.() ?? result.campaign.startDayKey,
      endDayKey: result.campaign.endDayKey.toISOString?.() ?? result.campaign.endDayKey,
      positiveBoostPct: result.campaign.positiveBoostPct,
      negativeBoostPct: result.campaign.negativeBoostPct,
      title: result.campaign.title,
      status: result.campaign.status,
      packageKeySnapshot: result.campaign.packageKeySnapshot,
      totalPriceSnapshot: result.campaign.totalPriceSnapshot?.toString?.() ?? result.campaign.totalPriceSnapshot,
      createdAt: result.campaign.createdAt.toISOString?.() ?? result.campaign.createdAt,
      totalPriceUsd: result.totalPrice.toString(),
    });
  } catch (e) {
    console.error('[category-marketing-campaigns POST]', e);
    const msg = e instanceof Error ? e.message : 'Failed to create campaign';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
