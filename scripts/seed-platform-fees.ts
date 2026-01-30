/**
 * Seed PlatformFeeLevelConfig and ShippingProfileFeeConfig (settlement commission, logistics, returns).
 * Idempotent — upserts by unique keys.
 *
 * Run: npx tsx scripts/seed-platform-fees.ts
 * Or:  npm run seed:platform-fees
 *
 * ShippingProfileFeeConfig: LIGHT=0.80, MEDIUM=1.20, HEAVY=2.50, BULKY=3.00
 * PlatformFeeLevelConfig: L1-1, L2-2, L3-3, L4-4, L5-99 with commission/logistics/return ranges
 */

import { PrismaClient, ShippingProfile } from '@prisma/client';

const prisma = new PrismaClient();

const SHIPPING_DEFAULTS: { shippingProfile: ShippingProfile; baseUnitFeeUsd: number }[] = [
  { shippingProfile: 'LIGHT', baseUnitFeeUsd: 0.8 },
  { shippingProfile: 'MEDIUM', baseUnitFeeUsd: 1.2 },
  { shippingProfile: 'HEAVY', baseUnitFeeUsd: 2.5 },
  { shippingProfile: 'BULKY', baseUnitFeeUsd: 3.0 },
];

const PLATFORM_LEVEL_DEFAULTS: {
  levelMin: number;
  levelMax: number;
  commissionRate: number;
  logisticsMultiplier: number;
  returnRateMin: number;
  returnRateMax: number;
}[] = [
  { levelMin: 1, levelMax: 1, commissionRate: 0.15, logisticsMultiplier: 1.2, returnRateMin: 0.03, returnRateMax: 0.05 },
  { levelMin: 2, levelMax: 2, commissionRate: 0.13, logisticsMultiplier: 1.1, returnRateMin: 0.03, returnRateMax: 0.05 },
  { levelMin: 3, levelMax: 3, commissionRate: 0.11, logisticsMultiplier: 1.0, returnRateMin: 0.025, returnRateMax: 0.045 },
  { levelMin: 4, levelMax: 4, commissionRate: 0.095, logisticsMultiplier: 0.92, returnRateMin: 0.02, returnRateMax: 0.04 },
  { levelMin: 5, levelMax: 99, commissionRate: 0.08, logisticsMultiplier: 0.85, returnRateMin: 0.02, returnRateMax: 0.035 },
];

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Seed PlatformFeeLevelConfig + ShippingProfileFeeConfig');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const row of SHIPPING_DEFAULTS) {
    await (prisma as any).shippingProfileFeeConfig.upsert({
      where: { shippingProfile: row.shippingProfile },
      create: {
        shippingProfile: row.shippingProfile,
        baseUnitFeeUsd: row.baseUnitFeeUsd,
        isActive: true,
      },
      update: {
        baseUnitFeeUsd: row.baseUnitFeeUsd,
        isActive: true,
      },
    });
    console.log('ShippingProfileFeeConfig:', row.shippingProfile, '=', row.baseUnitFeeUsd);
  }

  for (const row of PLATFORM_LEVEL_DEFAULTS) {
    const key = `${row.levelMin}-${row.levelMax}`;
    const existing = await (prisma as any).platformFeeLevelConfig.findFirst({
      where: { levelMin: row.levelMin, levelMax: row.levelMax },
    });
    if (existing) {
      await (prisma as any).platformFeeLevelConfig.update({
        where: { id: existing.id },
        data: {
          commissionRate: row.commissionRate,
          logisticsMultiplier: row.logisticsMultiplier,
          returnRateMin: row.returnRateMin,
          returnRateMax: row.returnRateMax,
          isActive: true,
        },
      });
      console.log('PlatformFeeLevelConfig updated:', key);
    } else {
      await (prisma as any).platformFeeLevelConfig.create({
        data: {
          levelMin: row.levelMin,
          levelMax: row.levelMax,
          commissionRate: row.commissionRate,
          logisticsMultiplier: row.logisticsMultiplier,
          returnRateMin: row.returnRateMin,
          returnRateMax: row.returnRateMax,
          isActive: true,
        },
      });
      console.log('PlatformFeeLevelConfig created:', key);
    }
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
