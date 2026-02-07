/**
 * group_procurement_level.seed.ts
 * Seeds GroupProcurementLevelMetric: 8 groups × 5 levels = 40 rows.
 * Idempotent: upsert by (manufacturingGroup, level).
 */

import { PrismaClient, type ManufacturingGroup } from '@prisma/client';

export const groupProcurementLevelSeed = [
  // =========================
  // FAST SCALE GROUPS
  // JERSEY / WOVEN / KNITWEAR / ACCESSORY
  // =========================

  // JERSEY
  { manufacturingGroup: 'JERSEY' as const, level: 1, minTotalOrderedQty: 0, priceMultiplier: 1.0, leadTimeMultiplier: 1.0, maxFactoriesPerRfq: 2, maxOpenQty: 8000, maxFactoryTierAllowed: 1, xpAwardOnLevelUp: 0 },
  { manufacturingGroup: 'JERSEY' as const, level: 2, minTotalOrderedQty: 5000, priceMultiplier: 0.98, leadTimeMultiplier: 0.97, maxFactoriesPerRfq: 3, maxOpenQty: 20000, maxFactoryTierAllowed: 2, xpAwardOnLevelUp: 25 },
  { manufacturingGroup: 'JERSEY' as const, level: 3, minTotalOrderedQty: 20000, priceMultiplier: 0.96, leadTimeMultiplier: 0.94, maxFactoriesPerRfq: 3, maxOpenQty: 50000, maxFactoryTierAllowed: 3, xpAwardOnLevelUp: 50 },
  { manufacturingGroup: 'JERSEY' as const, level: 4, minTotalOrderedQty: 60000, priceMultiplier: 0.94, leadTimeMultiplier: 0.91, maxFactoriesPerRfq: 4, maxOpenQty: 120000, maxFactoryTierAllowed: 4, xpAwardOnLevelUp: 80 },
  { manufacturingGroup: 'JERSEY' as const, level: 5, minTotalOrderedQty: 150000, priceMultiplier: 0.92, leadTimeMultiplier: 0.88, maxFactoriesPerRfq: 4, maxOpenQty: 250000, maxFactoryTierAllowed: 5, xpAwardOnLevelUp: 120 },

  // WOVEN
  { manufacturingGroup: 'WOVEN' as const, level: 1, minTotalOrderedQty: 0, priceMultiplier: 1.0, leadTimeMultiplier: 1.0, maxFactoriesPerRfq: 2, maxOpenQty: 8000, maxFactoryTierAllowed: 1, xpAwardOnLevelUp: 0 },
  { manufacturingGroup: 'WOVEN' as const, level: 2, minTotalOrderedQty: 5000, priceMultiplier: 0.98, leadTimeMultiplier: 0.97, maxFactoriesPerRfq: 3, maxOpenQty: 20000, maxFactoryTierAllowed: 2, xpAwardOnLevelUp: 25 },
  { manufacturingGroup: 'WOVEN' as const, level: 3, minTotalOrderedQty: 20000, priceMultiplier: 0.96, leadTimeMultiplier: 0.94, maxFactoriesPerRfq: 3, maxOpenQty: 50000, maxFactoryTierAllowed: 3, xpAwardOnLevelUp: 50 },
  { manufacturingGroup: 'WOVEN' as const, level: 4, minTotalOrderedQty: 60000, priceMultiplier: 0.94, leadTimeMultiplier: 0.91, maxFactoriesPerRfq: 4, maxOpenQty: 120000, maxFactoryTierAllowed: 4, xpAwardOnLevelUp: 80 },
  { manufacturingGroup: 'WOVEN' as const, level: 5, minTotalOrderedQty: 150000, priceMultiplier: 0.92, leadTimeMultiplier: 0.88, maxFactoriesPerRfq: 4, maxOpenQty: 250000, maxFactoryTierAllowed: 5, xpAwardOnLevelUp: 120 },

  // KNITWEAR
  { manufacturingGroup: 'KNITWEAR' as const, level: 1, minTotalOrderedQty: 0, priceMultiplier: 1.0, leadTimeMultiplier: 1.0, maxFactoriesPerRfq: 2, maxOpenQty: 8000, maxFactoryTierAllowed: 1, xpAwardOnLevelUp: 0 },
  { manufacturingGroup: 'KNITWEAR' as const, level: 2, minTotalOrderedQty: 5000, priceMultiplier: 0.98, leadTimeMultiplier: 0.97, maxFactoriesPerRfq: 3, maxOpenQty: 20000, maxFactoryTierAllowed: 2, xpAwardOnLevelUp: 25 },
  { manufacturingGroup: 'KNITWEAR' as const, level: 3, minTotalOrderedQty: 20000, priceMultiplier: 0.96, leadTimeMultiplier: 0.94, maxFactoriesPerRfq: 3, maxOpenQty: 50000, maxFactoryTierAllowed: 3, xpAwardOnLevelUp: 50 },
  { manufacturingGroup: 'KNITWEAR' as const, level: 4, minTotalOrderedQty: 60000, priceMultiplier: 0.94, leadTimeMultiplier: 0.91, maxFactoriesPerRfq: 4, maxOpenQty: 120000, maxFactoryTierAllowed: 4, xpAwardOnLevelUp: 80 },
  { manufacturingGroup: 'KNITWEAR' as const, level: 5, minTotalOrderedQty: 150000, priceMultiplier: 0.92, leadTimeMultiplier: 0.88, maxFactoriesPerRfq: 4, maxOpenQty: 250000, maxFactoryTierAllowed: 5, xpAwardOnLevelUp: 120 },

  // ACCESSORY
  { manufacturingGroup: 'ACCESSORY' as const, level: 1, minTotalOrderedQty: 0, priceMultiplier: 1.0, leadTimeMultiplier: 1.0, maxFactoriesPerRfq: 2, maxOpenQty: 8000, maxFactoryTierAllowed: 1, xpAwardOnLevelUp: 0 },
  { manufacturingGroup: 'ACCESSORY' as const, level: 2, minTotalOrderedQty: 5000, priceMultiplier: 0.98, leadTimeMultiplier: 0.97, maxFactoriesPerRfq: 3, maxOpenQty: 20000, maxFactoryTierAllowed: 2, xpAwardOnLevelUp: 25 },
  { manufacturingGroup: 'ACCESSORY' as const, level: 3, minTotalOrderedQty: 20000, priceMultiplier: 0.96, leadTimeMultiplier: 0.94, maxFactoriesPerRfq: 3, maxOpenQty: 50000, maxFactoryTierAllowed: 3, xpAwardOnLevelUp: 50 },
  { manufacturingGroup: 'ACCESSORY' as const, level: 4, minTotalOrderedQty: 60000, priceMultiplier: 0.94, leadTimeMultiplier: 0.91, maxFactoriesPerRfq: 4, maxOpenQty: 120000, maxFactoryTierAllowed: 4, xpAwardOnLevelUp: 80 },
  { manufacturingGroup: 'ACCESSORY' as const, level: 5, minTotalOrderedQty: 150000, priceMultiplier: 0.92, leadTimeMultiplier: 0.88, maxFactoriesPerRfq: 4, maxOpenQty: 250000, maxFactoryTierAllowed: 5, xpAwardOnLevelUp: 120 },

  // =========================
  // MID GROUP - DENIM
  // =========================
  { manufacturingGroup: 'DENIM' as const, level: 1, minTotalOrderedQty: 0, priceMultiplier: 1.0, leadTimeMultiplier: 1.0, maxFactoriesPerRfq: 2, maxOpenQty: 5000, maxFactoryTierAllowed: 1, xpAwardOnLevelUp: 0 },
  { manufacturingGroup: 'DENIM' as const, level: 2, minTotalOrderedQty: 3000, priceMultiplier: 0.985, leadTimeMultiplier: 0.97, maxFactoriesPerRfq: 3, maxOpenQty: 15000, maxFactoryTierAllowed: 2, xpAwardOnLevelUp: 30 },
  { manufacturingGroup: 'DENIM' as const, level: 3, minTotalOrderedQty: 12000, priceMultiplier: 0.965, leadTimeMultiplier: 0.94, maxFactoriesPerRfq: 3, maxOpenQty: 40000, maxFactoryTierAllowed: 3, xpAwardOnLevelUp: 60 },
  { manufacturingGroup: 'DENIM' as const, level: 4, minTotalOrderedQty: 40000, priceMultiplier: 0.945, leadTimeMultiplier: 0.91, maxFactoriesPerRfq: 4, maxOpenQty: 90000, maxFactoryTierAllowed: 4, xpAwardOnLevelUp: 90 },
  { manufacturingGroup: 'DENIM' as const, level: 5, minTotalOrderedQty: 100000, priceMultiplier: 0.925, leadTimeMultiplier: 0.88, maxFactoriesPerRfq: 4, maxOpenQty: 180000, maxFactoryTierAllowed: 5, xpAwardOnLevelUp: 140 },

  // =========================
  // HARD GROUPS - OUTERWEAR / LEATHER / FOOTWEAR
  // =========================
  // OUTERWEAR
  { manufacturingGroup: 'OUTERWEAR' as const, level: 1, minTotalOrderedQty: 0, priceMultiplier: 1.0, leadTimeMultiplier: 1.0, maxFactoriesPerRfq: 2, maxOpenQty: 3000, maxFactoryTierAllowed: 1, xpAwardOnLevelUp: 0 },
  { manufacturingGroup: 'OUTERWEAR' as const, level: 2, minTotalOrderedQty: 2000, priceMultiplier: 0.985, leadTimeMultiplier: 0.96, maxFactoriesPerRfq: 2, maxOpenQty: 10000, maxFactoryTierAllowed: 2, xpAwardOnLevelUp: 35 },
  { manufacturingGroup: 'OUTERWEAR' as const, level: 3, minTotalOrderedQty: 8000, priceMultiplier: 0.965, leadTimeMultiplier: 0.93, maxFactoriesPerRfq: 3, maxOpenQty: 25000, maxFactoryTierAllowed: 3, xpAwardOnLevelUp: 70 },
  { manufacturingGroup: 'OUTERWEAR' as const, level: 4, minTotalOrderedQty: 25000, priceMultiplier: 0.945, leadTimeMultiplier: 0.9, maxFactoriesPerRfq: 3, maxOpenQty: 60000, maxFactoryTierAllowed: 4, xpAwardOnLevelUp: 110 },
  { manufacturingGroup: 'OUTERWEAR' as const, level: 5, minTotalOrderedQty: 60000, priceMultiplier: 0.925, leadTimeMultiplier: 0.87, maxFactoriesPerRfq: 4, maxOpenQty: 120000, maxFactoryTierAllowed: 5, xpAwardOnLevelUp: 170 },

  // LEATHER
  { manufacturingGroup: 'LEATHER' as const, level: 1, minTotalOrderedQty: 0, priceMultiplier: 1.0, leadTimeMultiplier: 1.0, maxFactoriesPerRfq: 2, maxOpenQty: 3000, maxFactoryTierAllowed: 1, xpAwardOnLevelUp: 0 },
  { manufacturingGroup: 'LEATHER' as const, level: 2, minTotalOrderedQty: 2000, priceMultiplier: 0.985, leadTimeMultiplier: 0.96, maxFactoriesPerRfq: 2, maxOpenQty: 10000, maxFactoryTierAllowed: 2, xpAwardOnLevelUp: 35 },
  { manufacturingGroup: 'LEATHER' as const, level: 3, minTotalOrderedQty: 8000, priceMultiplier: 0.965, leadTimeMultiplier: 0.93, maxFactoriesPerRfq: 3, maxOpenQty: 25000, maxFactoryTierAllowed: 3, xpAwardOnLevelUp: 70 },
  { manufacturingGroup: 'LEATHER' as const, level: 4, minTotalOrderedQty: 25000, priceMultiplier: 0.945, leadTimeMultiplier: 0.9, maxFactoriesPerRfq: 3, maxOpenQty: 60000, maxFactoryTierAllowed: 4, xpAwardOnLevelUp: 110 },
  { manufacturingGroup: 'LEATHER' as const, level: 5, minTotalOrderedQty: 60000, priceMultiplier: 0.925, leadTimeMultiplier: 0.87, maxFactoriesPerRfq: 4, maxOpenQty: 120000, maxFactoryTierAllowed: 5, xpAwardOnLevelUp: 170 },

  // FOOTWEAR
  { manufacturingGroup: 'FOOTWEAR' as const, level: 1, minTotalOrderedQty: 0, priceMultiplier: 1.0, leadTimeMultiplier: 1.0, maxFactoriesPerRfq: 2, maxOpenQty: 3000, maxFactoryTierAllowed: 1, xpAwardOnLevelUp: 0 },
  { manufacturingGroup: 'FOOTWEAR' as const, level: 2, minTotalOrderedQty: 2000, priceMultiplier: 0.985, leadTimeMultiplier: 0.96, maxFactoriesPerRfq: 2, maxOpenQty: 10000, maxFactoryTierAllowed: 2, xpAwardOnLevelUp: 35 },
  { manufacturingGroup: 'FOOTWEAR' as const, level: 3, minTotalOrderedQty: 8000, priceMultiplier: 0.965, leadTimeMultiplier: 0.93, maxFactoriesPerRfq: 3, maxOpenQty: 25000, maxFactoryTierAllowed: 3, xpAwardOnLevelUp: 70 },
  { manufacturingGroup: 'FOOTWEAR' as const, level: 4, minTotalOrderedQty: 25000, priceMultiplier: 0.945, leadTimeMultiplier: 0.9, maxFactoriesPerRfq: 3, maxOpenQty: 60000, maxFactoryTierAllowed: 4, xpAwardOnLevelUp: 110 },
  { manufacturingGroup: 'FOOTWEAR' as const, level: 5, minTotalOrderedQty: 60000, priceMultiplier: 0.925, leadTimeMultiplier: 0.87, maxFactoriesPerRfq: 4, maxOpenQty: 120000, maxFactoryTierAllowed: 5, xpAwardOnLevelUp: 170 },
] as const;

const MANUFACTURING_GROUPS: ManufacturingGroup[] = [
  'JERSEY',
  'WOVEN',
  'DENIM',
  'KNITWEAR',
  'OUTERWEAR',
  'LEATHER',
  'FOOTWEAR',
  'ACCESSORY',
];

export async function seedGroupProcurementLevels(prisma: PrismaClient): Promise<number> {
  let count = 0;

  for (const row of groupProcurementLevelSeed) {
    const level = row.level;
    if (level < 1 || level > 5) {
      throw new Error(
        `Invalid level ${level} for ${row.manufacturingGroup}. Level must be 1..5.`
      );
    }

    await prisma.groupProcurementLevelMetric.upsert({
      where: {
        manufacturingGroup_level: {
          manufacturingGroup: row.manufacturingGroup as ManufacturingGroup,
          level: row.level,
        },
      },
      create: {
        manufacturingGroup: row.manufacturingGroup as ManufacturingGroup,
        level: row.level,
        minTotalOrderedQty: row.minTotalOrderedQty,
        priceMultiplier: row.priceMultiplier,
        leadTimeMultiplier: row.leadTimeMultiplier,
        maxFactoriesPerRfq: row.maxFactoriesPerRfq,
        maxOpenQty: row.maxOpenQty,
        maxFactoryTierAllowed: row.maxFactoryTierAllowed,
        xpAwardOnLevelUp: row.xpAwardOnLevelUp,
      },
      update: {
        minTotalOrderedQty: row.minTotalOrderedQty,
        priceMultiplier: row.priceMultiplier,
        leadTimeMultiplier: row.leadTimeMultiplier,
        maxFactoriesPerRfq: row.maxFactoriesPerRfq,
        maxOpenQty: row.maxOpenQty,
        maxFactoryTierAllowed: row.maxFactoryTierAllowed,
        xpAwardOnLevelUp: row.xpAwardOnLevelUp,
      },
    });
    count++;
  }

  console.log(
    `Group procurement level seed: ${count} rows upserted (${MANUFACTURING_GROUPS.length} groups × 5 levels).`
  );
  return count;
}

export default seedGroupProcurementLevels;
