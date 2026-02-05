/**
 * Apply permanent warehouse awareness when marketing campaigns end.
 * Call after clock advance and warehouse ticks in advance-day.
 * Finds campaigns where endDayKey === currentDayKey - 1 (previous day), so message and awareness
 * run the day after the campaign ends. Upserts WarehouseAwarenessState and creates one MARKETING
 * inbox message per campaign (dedupeKey: MKT_CAMPAIGN_END:{campaignId}).
 * Awareness is NOT stored in BuildingMetricState.
 */

import prisma from '@/lib/prisma';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';
import { MessageCategory, MessageLevel, MessageKind, DepartmentCode } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

type EndingCampaign = {
  id: string;
  companyId: string;
  warehouseBuildingId: string;
  title: string | null;
  packageKeySnapshot: string;
  packageAwarenessGainDec: Decimal;
};

async function getEndingCampaigns(
  companyId: string,
  currentDayKey: Date
): Promise<EndingCampaign[]> {
  const previousDay = new Date(currentDayKey);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const previousDayNorm = normalizeUtcMidnight(previousDay);
  const results: EndingCampaign[] = [];

  const whCampaigns = await (prisma as any).warehouseMarketingCampaign.findMany({
    where: {
      companyId,
      endDayKey: previousDayNorm,
    },
    select: {
      id: true,
      companyId: true,
      warehouseBuildingId: true,
      title: true,
      packageKeySnapshot: true,
      package: { select: { awarenessGainDec: true } },
    },
  });
  for (const c of whCampaigns) {
    results.push({
      id: c.id,
      companyId: c.companyId,
      warehouseBuildingId: c.warehouseBuildingId,
      title: c.title,
      packageKeySnapshot: c.packageKeySnapshot ?? c.package?.key ?? '—',
      packageAwarenessGainDec: c.package?.awarenessGainDec ?? new Decimal(0),
    });
  }

  const catCampaigns = await (prisma as any).categoryMarketingCampaign.findMany({
    where: {
      companyId,
      endDayKey: previousDayNorm,
    },
    select: {
      id: true,
      companyId: true,
      warehouseBuildingId: true,
      title: true,
      packageKeySnapshot: true,
      package: { select: { awarenessGainDec: true } },
    },
  });
  for (const c of catCampaigns) {
    results.push({
      id: c.id,
      companyId: c.companyId,
      warehouseBuildingId: c.warehouseBuildingId,
      title: c.title,
      packageKeySnapshot: c.packageKeySnapshot ?? c.package?.key ?? '—',
      packageAwarenessGainDec: c.package?.awarenessGainDec ?? new Decimal(0),
    });
  }

  const prodCampaigns = await (prisma as any).productMarketingCampaign.findMany({
    where: {
      companyId,
      endDayKey: previousDayNorm,
    },
    select: {
      id: true,
      companyId: true,
      warehouseBuildingId: true,
      title: true,
      packageKeySnapshot: true,
      package: { select: { awarenessGainDec: true } },
    },
  });
  for (const c of prodCampaigns) {
    results.push({
      id: c.id,
      companyId: c.companyId,
      warehouseBuildingId: c.warehouseBuildingId,
      title: c.title,
      packageKeySnapshot: c.packageKeySnapshot ?? c.package?.key ?? '—',
      packageAwarenessGainDec: c.package?.awarenessGainDec ?? new Decimal(0),
    });
  }

  return results;
}

export async function applyCampaignEndAwareness(
  companyId: string,
  currentDayKey: Date
): Promise<void> {
  const campaigns = await getEndingCampaigns(companyId, currentDayKey);
  if (campaigns.length === 0) return;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { playerId: true },
  });
  if (!company?.playerId) return;

  for (const campaign of campaigns) {
    const dedupeKey = `MKT_CAMPAIGN_END:${campaign.id}`;
    const existing = await prisma.playerMessage.findUnique({
      where: { playerId_dedupeKey: { playerId: company.playerId, dedupeKey } },
    });
    if (existing) continue;

    const awarenessGain = campaign.packageAwarenessGainDec;
    const gainStr = awarenessGain.toString();
    const title = campaign.title?.trim() || campaign.packageKeySnapshot;
    const messageTitle = `Campaign ended: ${title}`;
    const messageBody = `Permanent awareness +${gainStr} added to warehouse.`;

    await prisma.$transaction(async (tx) => {
      const state = await (tx as any).warehouseAwarenessState.findUnique({
        where: { warehouseBuildingId: campaign.warehouseBuildingId },
        select: { id: true, awareness: true },
      });
      const currentAwareness = state?.awareness ?? new Decimal(0);
      const newAwareness = currentAwareness.add(awarenessGain);

      await (tx as any).warehouseAwarenessState.upsert({
        where: { warehouseBuildingId: campaign.warehouseBuildingId },
        create: {
          companyId: campaign.companyId,
          warehouseBuildingId: campaign.warehouseBuildingId,
          awareness: newAwareness,
        },
        update: { awareness: newAwareness, updatedAt: new Date() },
      });
    });

    try {
      await prisma.playerMessage.create({
        data: {
          playerId: company.playerId,
          category: MessageCategory.MARKETING,
          department: DepartmentCode.MARKETING,
          level: MessageLevel.INFO,
          kind: MessageKind.INFO,
          title: messageTitle,
          body: messageBody,
          dedupeKey,
        },
      });
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (code === 'P2002') return;
      throw err;
    }
  }
}
