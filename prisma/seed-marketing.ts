/**
 * Seed MarketingPricingRule + MarketingPackageDefinition only.
 * Idempotent: upsert by unique constraints. Do NOT touch main seed or other tables.
 * Run: npm run seed:marketing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- MarketingPricingRule seed (WAREHOUSE + CATEGORY) ---
const PRICING_RULES = [
  // WAREHOUSE
  { scope: 'WAREHOUSE' as const, minSku: 1, maxSku: 5, multiplier: '1.000', sortIndex: 10, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 6, maxSku: 10, multiplier: '1.080', sortIndex: 20, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 11, maxSku: 15, multiplier: '1.160', sortIndex: 30, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 16, maxSku: 20, multiplier: '1.240', sortIndex: 40, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 21, maxSku: 30, multiplier: '1.340', sortIndex: 50, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 31, maxSku: 40, multiplier: '1.450', sortIndex: 60, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 41, maxSku: 50, multiplier: '1.580', sortIndex: 70, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 51, maxSku: 70, multiplier: '1.720', sortIndex: 80, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 71, maxSku: 100, multiplier: '1.900', sortIndex: 90, isActive: true },
  { scope: 'WAREHOUSE' as const, minSku: 101, maxSku: null as number | null, multiplier: '2.100', sortIndex: 100, isActive: true },

  // CATEGORY
  { scope: 'CATEGORY' as const, minSku: 1, maxSku: 3, multiplier: '1.000', sortIndex: 10, isActive: true },
  { scope: 'CATEGORY' as const, minSku: 4, maxSku: 6, multiplier: '1.070', sortIndex: 20, isActive: true },
  { scope: 'CATEGORY' as const, minSku: 7, maxSku: 10, multiplier: '1.140', sortIndex: 30, isActive: true },
  { scope: 'CATEGORY' as const, minSku: 11, maxSku: 15, multiplier: '1.220', sortIndex: 40, isActive: true },
  { scope: 'CATEGORY' as const, minSku: 16, maxSku: 20, multiplier: '1.300', sortIndex: 50, isActive: true },
  { scope: 'CATEGORY' as const, minSku: 21, maxSku: 30, multiplier: '1.400', sortIndex: 60, isActive: true },
  { scope: 'CATEGORY' as const, minSku: 31, maxSku: 40, multiplier: '1.520', sortIndex: 70, isActive: true },
  { scope: 'CATEGORY' as const, minSku: 41, maxSku: 50, multiplier: '1.660', sortIndex: 80, isActive: true },
  { scope: 'CATEGORY' as const, minSku: 51, maxSku: null as number | null, multiplier: '1.820', sortIndex: 90, isActive: true },
];

// --- MarketingPackageDefinition seed (WAREHOUSE, CATEGORY, PRODUCT) ---
// 5 packages per scope (pricing cards)
// Added: awarenessGainDec (Decimal(10,4)) stored as string
const PACKAGES: Array<{
  scope: 'WAREHOUSE' | 'CATEGORY' | 'PRODUCT';
  key: 'STARTER' | 'BASIC' | 'STANDARD' | 'PRO' | 'ELITE';
  title: string;
  description: string;
  durationDays: number;
  positiveBoostPct: number;
  negativeBoostPct: number;
  priceUsd: string;
  awarenessGainDec: string; // Decimal(10,4) -> pass as string
  isActive: boolean;
  sortIndex: number;
}> = [
  // =========================
  // WAREHOUSE
  // =========================
  { scope: 'WAREHOUSE', key: 'STARTER',  title: 'Starter',  description: 'Warehouse boost +6% for 7 days',  durationDays: 7,  positiveBoostPct: 6,  negativeBoostPct: 0, priceUsd: '4000.00',  awarenessGainDec: '0.0100', isActive: true, sortIndex: 100 },
  { scope: 'WAREHOUSE', key: 'BASIC',    title: 'Basic',    description: 'Warehouse boost +10% for 14 days', durationDays: 14, positiveBoostPct: 10, negativeBoostPct: 0, priceUsd: '8000.00',  awarenessGainDec: '0.0200', isActive: true, sortIndex: 200 },
  { scope: 'WAREHOUSE', key: 'STANDARD', title: 'Standard', description: 'Warehouse boost +15% for 21 days', durationDays: 21, positiveBoostPct: 15, negativeBoostPct: 0, priceUsd: '13000.00', awarenessGainDec: '0.0300', isActive: true, sortIndex: 300 },
  { scope: 'WAREHOUSE', key: 'PRO',      title: 'Pro',      description: 'Warehouse boost +22% for 30 days', durationDays: 30, positiveBoostPct: 22, negativeBoostPct: 0, priceUsd: '20000.00', awarenessGainDec: '0.0400', isActive: true, sortIndex: 400 },
  { scope: 'WAREHOUSE', key: 'ELITE',    title: 'Elite',    description: 'Warehouse boost +30% for 45 days', durationDays: 45, positiveBoostPct: 30, negativeBoostPct: 0, priceUsd: '28000.00', awarenessGainDec: '0.0500', isActive: true, sortIndex: 500 },

  // =========================
  // CATEGORY
  // =========================
  { scope: 'CATEGORY', key: 'STARTER',  title: 'Starter',  description: 'Category boost +8% for 7 days',   durationDays: 7,  positiveBoostPct: 8,  negativeBoostPct: 0, priceUsd: '2000.00',  awarenessGainDec: '0.0100', isActive: true, sortIndex: 100 },
  { scope: 'CATEGORY', key: 'BASIC',    title: 'Basic',    description: 'Category boost +15% for 14 days', durationDays: 14, positiveBoostPct: 15, negativeBoostPct: 0, priceUsd: '4200.00',  awarenessGainDec: '0.0200', isActive: true, sortIndex: 200 },
  { scope: 'CATEGORY', key: 'STANDARD', title: 'Standard', description: 'Category boost +25% for 21 days', durationDays: 21, positiveBoostPct: 25, negativeBoostPct: 0, priceUsd: '7500.00',  awarenessGainDec: '0.0300', isActive: true, sortIndex: 300 },
  { scope: 'CATEGORY', key: 'PRO',      title: 'Pro',      description: 'Category boost +35% for 30 days', durationDays: 30, positiveBoostPct: 35, negativeBoostPct: 0, priceUsd: '12000.00', awarenessGainDec: '0.0400', isActive: true, sortIndex: 400 },
  { scope: 'CATEGORY', key: 'ELITE',    title: 'Elite',    description: 'Category boost +45% for 45 days', durationDays: 45, positiveBoostPct: 45, negativeBoostPct: 0, priceUsd: '18000.00', awarenessGainDec: '0.0500', isActive: true, sortIndex: 500 },

  // =========================
  // PRODUCT
  // =========================
  { scope: 'PRODUCT', key: 'STARTER',  title: 'Starter',  description: 'Product boost +10% for 7 days',  durationDays: 7,  positiveBoostPct: 10, negativeBoostPct: 0, priceUsd: '2500.00',  awarenessGainDec: '0.0100', isActive: true, sortIndex: 100 },
  { scope: 'PRODUCT', key: 'BASIC',    title: 'Basic',    description: 'Product boost +15% for 14 days', durationDays: 14, positiveBoostPct: 15, negativeBoostPct: 0, priceUsd: '5200.00',  awarenessGainDec: '0.0200', isActive: true, sortIndex: 200 },
  { scope: 'PRODUCT', key: 'STANDARD', title: 'Standard', description: 'Product boost +25% for 21 days', durationDays: 21, positiveBoostPct: 25, negativeBoostPct: 0, priceUsd: '8900.00',  awarenessGainDec: '0.0300', isActive: true, sortIndex: 300 },
  { scope: 'PRODUCT', key: 'PRO',      title: 'Pro',      description: 'Product boost +35% for 30 days', durationDays: 30, positiveBoostPct: 35, negativeBoostPct: 0, priceUsd: '14500.00', awarenessGainDec: '0.0400', isActive: true, sortIndex: 400 },
  { scope: 'PRODUCT', key: 'ELITE',    title: 'Elite',    description: 'Product boost +50% for 45 days', durationDays: 45, positiveBoostPct: 50, negativeBoostPct: 0, priceUsd: '22000.00', awarenessGainDec: '0.0500', isActive: true, sortIndex: 500 },
];

async function main() {
  let rulesCreated = 0;
  let rulesUpdated = 0;
  let packagesCreated = 0;
  let packagesUpdated = 0;

  const pricingRule = (prisma as any).marketingPricingRule;
  const pkgDef = (prisma as any).marketingPackageDefinition;

  // --- MarketingPricingRule: findFirst + update or create (idempotent; handles null maxSku) ---
  for (const r of PRICING_RULES) {
    const existing = await pricingRule.findFirst({
      where: { scope: r.scope, minSku: r.minSku, maxSku: r.maxSku ?? null },
    });

    const data = {
      multiplier: r.multiplier,
      isActive: r.isActive,
      sortIndex: r.sortIndex,
    };

    if (existing) {
      await pricingRule.update({ where: { id: existing.id }, data });
      rulesUpdated++;
    } else {
      await pricingRule.create({
        data: { scope: r.scope, minSku: r.minSku, maxSku: r.maxSku ?? undefined, ...data },
      });
      rulesCreated++;
    }
  }

  // --- MarketingPackageDefinition: upsert by (scope, key) ---
  for (const p of PACKAGES) {
    const before = await pkgDef.findUnique({
      where: { scope_key: { scope: p.scope, key: p.key } },
      select: { id: true },
    });

    await pkgDef.upsert({
      where: { scope_key: { scope: p.scope, key: p.key } },
      create: {
        scope: p.scope,
        key: p.key,
        title: p.title,
        description: p.description,
        durationDays: p.durationDays,
        positiveBoostPct: p.positiveBoostPct,
        negativeBoostPct: p.negativeBoostPct,
        priceUsd: p.priceUsd,
        awarenessGainDec: p.awarenessGainDec,
        isActive: p.isActive,
        sortIndex: p.sortIndex,
      },
      update: {
        title: p.title,
        description: p.description,
        durationDays: p.durationDays,
        positiveBoostPct: p.positiveBoostPct,
        negativeBoostPct: p.negativeBoostPct,
        priceUsd: p.priceUsd,
        awarenessGainDec: p.awarenessGainDec,
        isActive: p.isActive,
        sortIndex: p.sortIndex,
      },
    });

    if (before) packagesUpdated++;
    else packagesCreated++;
  }

  console.log('[seed-marketing] Done.');
  console.log('  MarketingPricingRule:  created %d, updated %d', rulesCreated, rulesUpdated);
  console.log('  MarketingPackageDefinition: created %d, updated %d', packagesCreated, packagesUpdated);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
