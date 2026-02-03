/**
 * Apply product/listing-level marketing to LISTED ShowcaseListing rows (final layer).
 * Call after applyWarehouseMarketing and applyCategoryMarketing in the same tick.
 * Reads active ProductMarketingCampaign rows for (warehouse, dayKey), adds campaign boost
 * to each listing's current boost (clamped 0..100). Does NOT touch price/band/season.
 */

import type { PrismaClient } from '@prisma/client';
import { ListingStatus } from '@prisma/client';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Apply active product marketing campaigns for the given warehouse/day.
 * Listing boosts are already set by warehouse + category; we add product campaign boost per listing.
 */
export async function applyProductMarketing(
  tx: Tx,
  companyId: string,
  warehouseBuildingId: string,
  dayKey: Date
): Promise<void> {
  const normalizedDayKey = normalizeUtcMidnight(dayKey);

  const campaigns = await (tx as any).productMarketingCampaign.findMany({
    where: {
      companyId,
      warehouseBuildingId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      startDayKey: { lte: normalizedDayKey },
      endDayKey: { gte: normalizedDayKey },
    },
    select: { listingId: true, positiveBoostPct: true, negativeBoostPct: true },
  });

  if (campaigns.length === 0) return;

  const listingIds = [...new Set(campaigns.map((c: { listingId: string }) => c.listingId))] as string[];
  const listings = await tx.showcaseListing.findMany({
    where: {
      id: { in: listingIds },
      companyId,
      warehouseBuildingId,
      status: ListingStatus.LISTED,
    },
    select: { id: true, positiveBoostPct: true, negativeBoostPct: true },
  });
  const listingMap = new Map(listings.map((l) => [l.id, l]));

  const groupKeyToIds = new Map<string, string[]>();
  for (const c of campaigns) {
    const listing = listingMap.get(c.listingId);
    if (!listing) continue;
    const newPos = clampPct(listing.positiveBoostPct + (c.positiveBoostPct ?? 0));
    const newNeg = clampPct(listing.negativeBoostPct + (c.negativeBoostPct ?? 0));
    const key = `${newPos},${newNeg}`;
    const ids = groupKeyToIds.get(key) ?? [];
    if (!ids.includes(c.listingId)) ids.push(c.listingId);
    groupKeyToIds.set(key, ids);
  }

  for (const [key, ids] of groupKeyToIds) {
    const [posStr, negStr] = key.split(',');
    await tx.showcaseListing.updateMany({
      where: { id: { in: ids } },
      data: {
        positiveBoostPct: parseInt(posStr!, 10),
        negativeBoostPct: parseInt(negStr!, 10),
      },
    });
  }
}
