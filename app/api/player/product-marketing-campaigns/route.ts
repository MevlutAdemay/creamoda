/**
 * GET /api/player/product-marketing-campaigns?warehouseBuildingId=...
 * POST /api/player/product-marketing-campaigns - create campaign (packageId, ledger + wallet)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { BuildingRole, ListingStatus } from '@prisma/client';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';
import { getPackage } from '@/lib/marketing/campaign-cost';
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

    const campaigns = await (prisma as any).productMarketingCampaign.findMany({
      where: {
        companyId: company.id,
        ...(warehouseBuildingId && { warehouseBuildingId }),
      },
      orderBy: { startDayKey: 'desc' },
      select: {
        id: true,
        warehouseBuildingId: true,
        listingId: true,
        listing: { select: { productTemplate: { select: { name: true } } } },
        startDayKey: true,
        endDayKey: true,
        positiveBoostPct: true,
        negativeBoostPct: true,
        title: true,
        status: true,
        packageKeySnapshot: true,
        packagePriceSnapshot: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      campaigns: campaigns.map(
        (c: {
          listing?: { productTemplate?: { name?: string } };
          startDayKey: Date;
          endDayKey: Date;
          packagePriceSnapshot: unknown;
          createdAt: Date;
          [k: string]: unknown;
        }) => ({
          id: c.id,
          warehouseBuildingId: c.warehouseBuildingId,
          listingId: c.listingId,
          productName: c.listing?.productTemplate?.name ?? null,
          startDayKey: c.startDayKey.toISOString?.() ?? c.startDayKey,
          endDayKey: c.endDayKey.toISOString?.() ?? c.endDayKey,
          positiveBoostPct: c.positiveBoostPct,
          negativeBoostPct: c.negativeBoostPct,
          title: c.title,
          status: c.status,
          packageKeySnapshot: c.packageKeySnapshot,
          packagePriceSnapshot: c.packagePriceSnapshot?.toString?.() ?? c.packagePriceSnapshot,
          createdAt: c.createdAt.toISOString?.() ?? c.createdAt,
        })
      ),
    });
  } catch (e) {
    console.error('[product-marketing-campaigns GET]', e);
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
    const { warehouseBuildingId, listingId, packageId, title, notes } = body as {
      warehouseBuildingId?: string;
      listingId?: string;
      packageId?: string;
      title?: string;
      notes?: string;
    };

    if (!warehouseBuildingId) {
      return NextResponse.json({ error: 'warehouseBuildingId is required' }, { status: 400 });
    }
    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
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

    const listing = await prisma.showcaseListing.findFirst({
      where: {
        id: listingId,
        companyId: company.id,
        warehouseBuildingId,
        status: ListingStatus.LISTED,
      },
      select: { id: true },
    });
    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found or not LISTED in this warehouse' },
        { status: 404 }
      );
    }

    const pkg = await getPackage(prisma, packageId, 'PRODUCT');

    const startDayKey = normalizeUtcMidnight(await getCompanyGameDayKey(company.id));
    const endDayKey = new Date(startDayKey);
    endDayKey.setUTCDate(endDayKey.getUTCDate() + pkg.durationDays - 1);
    const endDayKeyNorm = normalizeUtcMidnight(endDayKey);

    const overlapping = await (prisma as any).productMarketingCampaign.findFirst({
      where: {
        companyId: company.id,
        listingId,
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        startDayKey: { lte: endDayKeyNorm },
        endDayKey: { gte: startDayKey },
      },
      select: { id: true },
    });
    if (overlapping) {
      return NextResponse.json(
        { error: 'Campaign already exists for this product in the selected period.' },
        { status: 409 }
      );
    }

    const totalPrice = pkg.priceUsd;

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
        const campaign = await (tx as any).productMarketingCampaign.create({
          data: {
            companyId: company.id,
            warehouseBuildingId,
            listingId,
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
          },
          select: {
            id: true,
            warehouseBuildingId: true,
            listingId: true,
            listing: { select: { productTemplate: { select: { name: true } } } },
            startDayKey: true,
            endDayKey: true,
            positiveBoostPct: true,
            negativeBoostPct: true,
            title: true,
            status: true,
            packageKeySnapshot: true,
            packagePriceSnapshot: true,
            createdAt: true,
          },
        });

        const idempotencyKey = `MKT:PRODUCT:${campaign.id}`;
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
          note: `Product campaign ${pkg.key}`,
        });

        return { campaign, totalPrice };
      },
      { timeout: 10000 }
    );

    return NextResponse.json({
      id: result.campaign.id,
      warehouseBuildingId: result.campaign.warehouseBuildingId,
      listingId: result.campaign.listingId,
      productName: result.campaign.listing?.productTemplate?.name ?? null,
      startDayKey: result.campaign.startDayKey.toISOString?.() ?? result.campaign.startDayKey,
      endDayKey: result.campaign.endDayKey.toISOString?.() ?? result.campaign.endDayKey,
      positiveBoostPct: result.campaign.positiveBoostPct,
      negativeBoostPct: result.campaign.negativeBoostPct,
      title: result.campaign.title,
      status: result.campaign.status,
      packageKeySnapshot: result.campaign.packageKeySnapshot,
      packagePriceSnapshot: result.campaign.packagePriceSnapshot?.toString?.() ?? result.campaign.packagePriceSnapshot,
      createdAt: result.campaign.createdAt.toISOString?.() ?? result.campaign.createdAt,
      totalPriceUsd: result.totalPrice.toString(),
    });
  } catch (e) {
    console.error('[product-marketing-campaigns POST]', e);
    const msg = e instanceof Error ? e.message : 'Failed to create campaign';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
