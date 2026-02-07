/**
 * factory_prod.seed.ts - Seed 160 production factories across 5 countries (EG, TN, CN, IN, BD).
 * 5 countries × 8 manufacturing groups × 4 cities = 160 factories.
 * Idempotent: upsert by code.
 */

import { PrismaClient, type ManufacturingGroup } from '@prisma/client';

const TARGET_ISO2 = ['EG', 'TN', 'CN', 'IN', 'BD'] as const;
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

/** Base lead time (days) by country – distance to EU. */
const LEAD_BASE: Record<string, number> = {
  EG: 28,
  TN: 28,
  IN: 36,
  CN: 44,
  BD: 48,
};

/** Lead time delta by manufacturing group. */
const LEAD_DELTA_GROUP: Record<ManufacturingGroup, number> = {
  JERSEY: 0,
  WOVEN: 1,
  DENIM: 2,
  KNITWEAR: 1,
  OUTERWEAR: 4,
  LEATHER: 3,
  FOOTWEAR: 3,
  ACCESSORY: 0,
};

/** Base daily capacity by country. */
const CAPACITY_BASE: Record<string, number> = {
  EG: 80,
  TN: 80,
  IN: 120,
  CN: 150,
  BD: 140,
};

/** Default MOQ by country. */
const MOQ_BASE: Record<string, number> = {
  EG: 100,
  TN: 100,
  IN: 200,
  CN: 300,
  BD: 250,
};

/** Optional capacity tweak by group (add to base). */
const CAPACITY_TWEAK_GROUP: Record<ManufacturingGroup, number> = {
  JERSEY: 0,
  WOVEN: 0,
  DENIM: 10,
  KNITWEAR: 0,
  OUTERWEAR: -10,
  LEATHER: -15,
  FOOTWEAR: -10,
  ACCESSORY: 5,
};

/** Optional MOQ tweak by group (add to base). */
const MOQ_TWEAK_GROUP: Record<ManufacturingGroup, number> = {
  JERSEY: 0,
  WOVEN: 0,
  DENIM: 25,
  KNITWEAR: 0,
  OUTERWEAR: 50,
  LEATHER: 30,
  FOOTWEAR: 20,
  ACCESSORY: 0,
};

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(value);
  return Math.min(max, Math.max(min, n));
}

export async function seedFactoriesProd(prisma: PrismaClient): Promise<number> {
  const countries = await prisma.country.findMany({
    where: { iso2: { in: [...TARGET_ISO2] } },
    select: { id: true, iso2: true, name: true },
    orderBy: { iso2: 'asc' },
  });

  if (countries.length !== TARGET_ISO2.length) {
    const found = countries.map((c) => c.iso2).join(', ');
    throw new Error(
      `Expected ${TARGET_ISO2.length} countries (EG, TN, CN, IN, BD). Found: ${found}`
    );
  }

  let upsertCount = 0;

  for (const country of countries) {
    const iso2 = country.iso2;
    const cities = await prisma.city.findMany({
      where: { countryId: country.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 4,
    });

    if (cities.length < 4) {
      throw new Error(
        `Country ${iso2} (${country.name}) has ${cities.length} cities. Need at least 4.`
      );
    }

    const leadBase = LEAD_BASE[iso2] ?? 30;
    const capacityBase = CAPACITY_BASE[iso2] ?? 100;
    const moqBase = MOQ_BASE[iso2] ?? 150;

    for (const group of MANUFACTURING_GROUPS) {
      const leadDelta = LEAD_DELTA_GROUP[group];
      const capTweak = CAPACITY_TWEAK_GROUP[group];
      const moqTweak = MOQ_TWEAK_GROUP[group];

      for (let cityIndex = 0; cityIndex < 4; cityIndex++) {
        const city = cities[cityIndex];
        if (!city) continue;

        const code = `F-${iso2}-${group}-${String(cityIndex + 1).padStart(2, '0')}`;
        const name = `${country.name} ${group} - ${city.name}`;

        const baseLeadTimeDays = clampInt(
          leadBase + leadDelta + cityIndex,
          14,
          60
        );
        const baseDailyCapacity = clampInt(
          capacityBase + capTweak,
          20,
          500
        );
        const defaultMoq = clampInt(moqBase + moqTweak, 50, 1000);

        await prisma.factory.upsert({
          where: { code },
          update: {
            name,
            countryId: country.id,
            cityId: city.id,
            manufacturingGroup: group,
            productQuality: 'STANDARD',
            factoryTier: 1,
            baseLeadTimeDays,
            baseDailyCapacity,
            defaultMoq,
            priceNoiseMinPct: 0.02,
            priceNoiseMaxPct: 0.08,
            isActive: true,
          },
          create: {
            code,
            name,
            countryId: country.id,
            cityId: city.id,
            manufacturingGroup: group,
            productQuality: 'STANDARD',
            factoryTier: 1,
            baseLeadTimeDays,
            baseDailyCapacity,
            defaultMoq,
            priceNoiseMinPct: 0.02,
            priceNoiseMaxPct: 0.08,
            isActive: true,
          },
        });
        upsertCount++;
      }
    }
  }

  console.log(`Factory prod seed: ${upsertCount} factory upserts (${TARGET_ISO2.length} countries × ${MANUFACTURING_GROUPS.length} groups × 4 cities).`);
  return upsertCount;
}

export default seedFactoriesProd;
