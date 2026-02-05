/**
 * GET /api/player/marketing-campaigns?warehouseBuildingId=...
 * Returns warehouse, category, and product marketing campaigns for the company (optional filter by warehouse)
 * and current game dayKey for active-window computation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { getCompanyGameDayKey, formatDayKeyString } from '@/lib/game/game-clock';

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

    const currentDayKey = await getCompanyGameDayKey(company.id);
    const currentDayKeyStr = formatDayKeyString(currentDayKey);

    const [warehouseCampaigns, categoryCampaigns, productCampaigns] = await Promise.all([
      (prisma as any).warehouseMarketingCampaign.findMany({
        where: {
          companyId: company.id,
          ...(warehouseBuildingId && { warehouseBuildingId }),
        },
        orderBy: { startDayKey: 'desc' },
        select: {
          id: true,
          warehouseBuildingId: true,
          startDayKey: true,
          endDayKey: true,
          positiveBoostPct: true,
          negativeBoostPct: true,
          title: true,
          status: true,
          packageKeySnapshot: true,
        },
      }),
      (prisma as any).categoryMarketingCampaign.findMany({
        where: {
          companyId: company.id,
          ...(warehouseBuildingId && { warehouseBuildingId }),
        },
        orderBy: { startDayKey: 'desc' },
        select: {
          id: true,
          warehouseBuildingId: true,
          categoryNodeId: true,
          startDayKey: true,
          endDayKey: true,
          positiveBoostPct: true,
          negativeBoostPct: true,
          title: true,
          status: true,
          packageKeySnapshot: true,
        },
      }),
      (prisma as any).productMarketingCampaign.findMany({
        where: {
          companyId: company.id,
          ...(warehouseBuildingId && { warehouseBuildingId }),
        },
        orderBy: { startDayKey: 'desc' },
        select: {
          id: true,
          warehouseBuildingId: true,
          listingId: true,
          startDayKey: true,
          endDayKey: true,
          positiveBoostPct: true,
          negativeBoostPct: true,
          title: true,
          status: true,
          packageKeySnapshot: true,
        },
      }),
    ]);

    const mapDate = (d: Date) => (d && typeof d.toISOString === 'function' ? d.toISOString().slice(0, 10) : String(d));

    return NextResponse.json({
      currentDayKey: currentDayKeyStr,
      warehouseCampaigns: warehouseCampaigns.map((c: { startDayKey: Date; endDayKey: Date; [k: string]: unknown }) => ({
        id: c.id,
        warehouseBuildingId: c.warehouseBuildingId,
        startDayKey: mapDate(c.startDayKey),
        endDayKey: mapDate(c.endDayKey),
        positiveBoostPct: c.positiveBoostPct,
        negativeBoostPct: c.negativeBoostPct,
        title: c.title,
        status: c.status,
        packageKeySnapshot: c.packageKeySnapshot,
      })),
      categoryCampaigns: categoryCampaigns.map((c: { startDayKey: Date; endDayKey: Date; [k: string]: unknown }) => ({
        id: c.id,
        warehouseBuildingId: c.warehouseBuildingId,
        categoryNodeId: c.categoryNodeId,
        startDayKey: mapDate(c.startDayKey),
        endDayKey: mapDate(c.endDayKey),
        positiveBoostPct: c.positiveBoostPct,
        negativeBoostPct: c.negativeBoostPct,
        title: c.title,
        status: c.status,
        packageKeySnapshot: c.packageKeySnapshot,
      })),
      productCampaigns: productCampaigns.map((c: { startDayKey: Date; endDayKey: Date; [k: string]: unknown }) => ({
        id: c.id,
        warehouseBuildingId: c.warehouseBuildingId,
        listingId: c.listingId,
        startDayKey: mapDate(c.startDayKey),
        endDayKey: mapDate(c.endDayKey),
        positiveBoostPct: c.positiveBoostPct,
        negativeBoostPct: c.negativeBoostPct,
        title: c.title,
        status: c.status,
        packageKeySnapshot: c.packageKeySnapshot,
      })),
    });
  } catch (e) {
    console.error('[marketing-campaigns GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load campaigns' },
      { status: 500 }
    );
  }
}
