/**
 * GET: Return sales debug data (DailyProductSalesLog) for the last N days.
 * Query: days=7 (default, max 30), warehouseBuildingId optional.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';

export async function GET(request: Request) {
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
    const daysParam = searchParams.get('days');
    const days = Math.min(30, Math.max(1, parseInt(daysParam ?? '7', 10) || 7));
    const warehouseBuildingId = searchParams.get('warehouseBuildingId') ?? undefined;

    const currentDayKey = await getCompanyGameDayKey(company.id);
    const startDate = new Date(currentDayKey);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);
    const startDayKey = normalizeUtcMidnight(startDate);

    const where: { companyId: string; dayKey: { gte: Date }; warehouseBuildingId?: string } = {
      companyId: company.id,
      dayKey: { gte: startDayKey },
    };
    if (warehouseBuildingId) where.warehouseBuildingId = warehouseBuildingId;

    const rows = await prisma.dailyProductSalesLog.findMany({
      where,
      orderBy: [{ dayKey: 'desc' }, { warehouseBuildingId: 'asc' }, { productTemplateId: 'asc' }],
      select: {
        dayKey: true,
        warehouseBuildingId: true,
        marketZone: true,
        productTemplateId: true,
        qtyOrdered: true,
        qtyShipped: true,
        expectedUnits: true,
        finalUnits: true,
        priceIndex: true,
        priceMultiplier: true,
        seasonScore: true,
        seasonMultiplier: true,
        listingKey: true,
        baseQty: true,
        tierUsed: true,
        positiveBoostPct: true,
        negativeBoostPct: true,
        blockedByPrice: true,
        blockedBySeason: true,
        reasonsSnapshot: true,
        warehouse: {
          select: { id: true, marketZone: true, name: true },
        },
        productTemplate: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    const snapshot = (r: (typeof rows)[number]) => {
      const s = r.reasonsSnapshot as Record<string, unknown> | null;
      if (!s || typeof s !== 'object') return {};
      return s;
    };

    const payload = rows.map((r) => {
      const rs = snapshot(r);
      const expectedUnits = r.expectedUnits ?? null;
      const priceMultiplier =
        r.priceMultiplier != null
          ? r.priceMultiplier
          : typeof rs.priceMultiplier === 'number'
            ? rs.priceMultiplier
            : null;
      const finalDesired =
        expectedUnits != null && priceMultiplier != null
          ? Math.round(expectedUnits * priceMultiplier)
          : null;
      return {
        dayKey: r.dayKey.toISOString().slice(0, 10),
        warehouseBuildingId: r.warehouseBuildingId ?? undefined,
        warehouseName: r.warehouse?.name ?? undefined,
        marketZone: r.marketZone,
        productTemplateId: r.productTemplateId,
        productName: r.productTemplate?.name ?? r.productTemplate?.code ?? undefined,
        qtyOrdered: r.qtyOrdered,
        qtyShipped: r.qtyShipped,
        expectedUnits: r.expectedUnits ?? undefined,
        finalUnits: r.finalUnits ?? undefined,
        priceIndex: r.priceIndex ?? undefined,
        seasonScore: r.seasonScore ?? undefined,
        priceMultiplier: r.priceMultiplier ?? (typeof rs.priceMultiplier === 'number' ? rs.priceMultiplier : undefined),
        seasonMultiplier: r.seasonMultiplier ?? undefined,
        listingKey: r.listingKey ?? undefined,
        baseQty: r.baseQty ?? undefined,
        positiveBoostPct: r.positiveBoostPct ?? undefined,
        negativeBoostPct: r.negativeBoostPct ?? undefined,
        tierUsed: r.tierUsed ?? (typeof rs.tierUsed === 'number' ? rs.tierUsed : undefined),
        bandMatched: typeof rs.bandMatched === 'boolean' ? rs.bandMatched : undefined,
        finalDesired,
        blockedByPrice: r.blockedByPrice ?? (typeof rs.blockedByPrice === 'boolean' ? rs.blockedByPrice : undefined),
        blockedBySeason: r.blockedBySeason ?? (typeof rs.blockedBySeason === 'boolean' ? rs.blockedBySeason : undefined),
        modelRankUsed: typeof rs.modelRankUsed === 'number' ? rs.modelRankUsed : undefined,
        minDaily: typeof rs.minDaily === 'number' ? rs.minDaily : undefined,
        maxDaily: typeof rs.maxDaily === 'number' ? rs.maxDaily : undefined,
        baseUnits: typeof rs.baseUnits === 'number' ? rs.baseUnits : undefined,
        jitterFractionUsed: typeof rs.jitterFractionUsed === 'number' ? rs.jitterFractionUsed : undefined,
        reasonsSnapshot: rs,
      };
    });

    return NextResponse.json(payload);
  } catch (e) {
    console.error('[sim-debug]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to get sim debug' },
      { status: 500 }
    );
  }
}
