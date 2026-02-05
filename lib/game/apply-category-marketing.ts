/**
 * Apply category-level marketing to LISTED ShowcaseListing rows (layer on top of warehouse-level).
 * Call after applyWarehouseMarketing in the same tick. Reads active CategoryMarketingCampaign
 * for (warehouse, dayKey), maps listings to L2 category, adds category boost to existing
 * listing boost (clamped 0..100). Does NOT touch price/band/season; Step A still reads only snapshot.
 */

import type { PrismaClient } from '@prisma/client';
import { CategoryLevel, ListingStatus } from '@prisma/client';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Apply active category marketing campaigns for the given warehouse/day.
 * Warehouse-level boost is already on listings; we add category boost per L2 and update.
 */
export async function applyCategoryMarketing(
  tx: Tx,
  companyId: string,
  warehouseBuildingId: string,
  dayKey: Date
): Promise<void> {
  const normalizedDayKey = normalizeUtcMidnight(dayKey);

  // 1) Warehouse campaign sum (same as apply-warehouse-marketing) so we can set base + category
  const warehouseCampaigns = await (tx as any).warehouseMarketingCampaign.findMany({
    where: {
      companyId,
      warehouseBuildingId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      startDayKey: { lte: normalizedDayKey },
      endDayKey: { gte: normalizedDayKey },
    },
    select: { positiveBoostPct: true, negativeBoostPct: true },
  });
  let warehousePos = 0;
  let warehouseNeg = 0;
  for (const c of warehouseCampaigns) {
    warehousePos += c.positiveBoostPct ?? 0;
    warehouseNeg += c.negativeBoostPct ?? 0;
  }
  const basePositive = clampPct(warehousePos);
  const baseNegative = clampPct(warehouseNeg);

  // 2) Active category campaigns for this warehouse/day, summed per categoryNodeId (L2)
  const categoryCampaigns = await (tx as any).categoryMarketingCampaign.findMany({
    where: {
      companyId,
      warehouseBuildingId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      startDayKey: { lte: normalizedDayKey },
      endDayKey: { gte: normalizedDayKey },
    },
    select: { categoryNodeId: true, positiveBoostPct: true, negativeBoostPct: true },
  });

  if (categoryCampaigns.length === 0) {
    return;
  }

  const categoryBoostByL2 = new Map<string, { pos: number; neg: number }>();
  for (const c of categoryCampaigns) {
    const existing = categoryBoostByL2.get(c.categoryNodeId) ?? { pos: 0, neg: 0 };
    existing.pos += c.positiveBoostPct ?? 0;
    existing.neg += c.negativeBoostPct ?? 0;
    categoryBoostByL2.set(c.categoryNodeId, existing);
  }
  for (const [l2Id, v] of categoryBoostByL2) {
    categoryBoostByL2.set(l2Id, { pos: clampPct(v.pos), neg: clampPct(v.neg) });
  }

  // 3) LISTED listings for this warehouse with productTemplateId and permanent boost
  const listings = await tx.showcaseListing.findMany({
    where: {
      companyId,
      warehouseBuildingId,
      status: ListingStatus.LISTED,
    },
    select: { id: true, productTemplateId: true, permanentPositiveBoostPct: true },
  });
  if (listings.length === 0) return;

  const templateIds = [...new Set(listings.map((l) => l.productTemplateId))];
  const templates = await tx.productTemplate.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, categoryL3Id: true },
  });
  const templateToL3 = new Map(templates.map((t) => [t.id, t.categoryL3Id]));

  const l3Ids = [...new Set(templates.map((t) => t.categoryL3Id).filter(Boolean))] as string[];
  if (l3Ids.length === 0) return;

  const l3Nodes = await tx.productCategoryNode.findMany({
    where: { id: { in: l3Ids }, level: CategoryLevel.L3 },
    select: { id: true, parentId: true },
  });
  const l3ToL2 = new Map(l3Nodes.map((n) => [n.id, n.parentId]).filter(([, p]) => p != null) as [string, string][]);

  // listingId -> L2 category id (only if we have a campaign for that L2)
  const listingIdToL2 = new Map<string, string>();
  const listingIdToPerm = new Map<string, number>();
  for (const l of listings) {
    listingIdToPerm.set(l.id, l.permanentPositiveBoostPct ?? 0);
    const l3Id = templateToL3.get(l.productTemplateId);
    const l2Id = l3Id ? l3ToL2.get(l3Id) : undefined;
    if (l2Id && categoryBoostByL2.has(l2Id)) {
      listingIdToL2.set(l.id, l2Id);
    }
  }

  // 4) Group listing IDs by (positiveBoostPct, negativeBoostPct); base includes permanent boost.
  const groupKeyToIds = new Map<string, string[]>();
  for (const [listingId, l2Id] of listingIdToL2) {
    const perm = listingIdToPerm.get(listingId) ?? 0;
    const boost = categoryBoostByL2.get(l2Id)!;
    const pos = clampPct(perm + basePositive + boost.pos);
    const neg = clampPct(baseNegative + boost.neg);
    const key = `${pos},${neg}`;
    const ids = groupKeyToIds.get(key) ?? [];
    ids.push(listingId);
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
