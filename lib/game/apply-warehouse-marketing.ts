/**
 * Apply warehouse-level marketing to LISTED ShowcaseListing rows before Step A.
 * Reads active WarehouseMarketingCampaign rows for (warehouse, dayKey), sums boosts, updates listings.
 * Does NOT touch price/band/season; Step A still reads only from listing snapshot.
 */

import type { PrismaClient } from '@prisma/client';
import { ListingStatus } from '@prisma/client';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';

/** Transaction client: what prisma.$transaction(async (tx) => ...) passes in (no $connect, $disconnect, $on, $transaction, $extends). */
type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

/**
 * Apply active warehouse marketing campaigns for the given day: compute effective
 * positive/negative boost and update all LISTED ShowcaseListing rows for that warehouse.
 * Call this inside runWarehouseDayTick transaction, before Step A reads listings.
 */
export async function applyWarehouseMarketing(
  tx: Tx,
  companyId: string,
  warehouseBuildingId: string,
  dayKey: Date
): Promise<void> {
  const normalizedDayKey = normalizeUtcMidnight(dayKey);
  const client = tx as unknown as { warehouseMarketingCampaign: { findMany: (args: { where: unknown; select: unknown }) => Promise<{ positiveBoostPct: number | null; negativeBoostPct: number | null }[]> } };

  const campaigns = await client.warehouseMarketingCampaign.findMany({
    where: {
      companyId,
      warehouseBuildingId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      startDayKey: { lte: normalizedDayKey },
      endDayKey: { gte: normalizedDayKey },
    },
    select: { positiveBoostPct: true, negativeBoostPct: true },
  });

  let sumPositive = 0;
  let sumNegative = 0;
  for (const c of campaigns) {
    sumPositive += c.positiveBoostPct ?? 0;
    sumNegative += c.negativeBoostPct ?? 0;
  }
  const positiveEffective = Math.min(100, Math.max(0, sumPositive));
  const negativeEffective = Math.min(100, Math.max(0, sumNegative));

  await tx.showcaseListing.updateMany({
    where: {
      companyId,
      warehouseBuildingId,
      status: ListingStatus.LISTED,
    },
    data: {
      positiveBoostPct: positiveEffective,
      negativeBoostPct: negativeEffective,
    },
  });
}
