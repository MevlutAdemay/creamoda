/**
 * Seed ProductSalesBandConfig for L2 categories.
 * Idempotent — find-then-update-or-create by (categoryL3Id, productQuality, tierMin, tierMax).
 *
 * Run: npx tsx scripts/seed-product-sales-band-config.ts
 * Or:  npm run seed:product-sales-band
 */

import { CategoryLevel, PrismaClient, ProductQuality } from '@prisma/client';

const prisma = new PrismaClient();

const L2_CODES = [
  'TOP',
  'BTM',
  'JAC',
  'COA',
  'KNT_TOP',
  'KNT_BOT',
  'DNM_TOP',
  'DNM_BOT',
  'LTH_TOPS',
  'LTH_BOTTOMS',
  'SHO',
  'FDRS',
  'FSU',
] as const;

type BandRow = { tier: number; minDaily: number; maxDaily: number; expectedMode: number };

const BANDS: Record<string, BandRow[]> = {
  TOP: [
    { tier: 1, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 3, expectedMode: 2 },
    { tier: 3, minDaily: 1, maxDaily: 5, expectedMode: 3 },
    { tier: 4, minDaily: 2, maxDaily: 7, expectedMode: 4 },
    { tier: 5, minDaily: 3, maxDaily: 10, expectedMode: 6 },
  ],
  BTM: [
    { tier: 1, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 3, expectedMode: 2 },
    { tier: 3, minDaily: 1, maxDaily: 4, expectedMode: 3 },
    { tier: 4, minDaily: 2, maxDaily: 6, expectedMode: 4 },
    { tier: 5, minDaily: 3, maxDaily: 9, expectedMode: 6 },
  ],
  SHO: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 3, minDaily: 1, maxDaily: 3, expectedMode: 2 },
    { tier: 4, minDaily: 1, maxDaily: 4, expectedMode: 3 },
    { tier: 5, minDaily: 2, maxDaily: 6, expectedMode: 4 },
  ],
  JAC: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 3, minDaily: 0, maxDaily: 3, expectedMode: 2 },
    { tier: 4, minDaily: 1, maxDaily: 4, expectedMode: 3 },
    { tier: 5, minDaily: 1, maxDaily: 5, expectedMode: 3 },
  ],
  COA: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 3, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 4, minDaily: 1, maxDaily: 3, expectedMode: 2 },
    { tier: 5, minDaily: 1, maxDaily: 4, expectedMode: 2 },
  ],
  FDRS: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 3, minDaily: 1, maxDaily: 3, expectedMode: 2 },
    { tier: 4, minDaily: 1, maxDaily: 4, expectedMode: 3 },
    { tier: 5, minDaily: 2, maxDaily: 6, expectedMode: 4 },
  ],
  FSU: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 3, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 4, minDaily: 1, maxDaily: 3, expectedMode: 2 },
    { tier: 5, minDaily: 1, maxDaily: 4, expectedMode: 2 },
  ],
  KNT_TOP: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 3, minDaily: 1, maxDaily: 4, expectedMode: 2 },
    { tier: 4, minDaily: 2, maxDaily: 6, expectedMode: 4 },
    { tier: 5, minDaily: 3, maxDaily: 8, expectedMode: 5 },
  ],
  KNT_BOT: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 3, minDaily: 1, maxDaily: 3, expectedMode: 2 },
    { tier: 4, minDaily: 2, maxDaily: 5, expectedMode: 3 },
    { tier: 5, minDaily: 3, maxDaily: 7, expectedMode: 5 },
  ],
  DNM_TOP: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 3, minDaily: 1, maxDaily: 4, expectedMode: 3 },
    { tier: 4, minDaily: 2, maxDaily: 6, expectedMode: 4 },
    { tier: 5, minDaily: 3, maxDaily: 8, expectedMode: 5 },
  ],
  DNM_BOT: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 3, minDaily: 1, maxDaily: 4, expectedMode: 3 },
    { tier: 4, minDaily: 2, maxDaily: 6, expectedMode: 4 },
    { tier: 5, minDaily: 3, maxDaily: 9, expectedMode: 6 },
  ],
  LTH_TOPS: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 3, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 4, minDaily: 1, maxDaily: 3, expectedMode: 2 },
    { tier: 5, minDaily: 1, maxDaily: 4, expectedMode: 2 },
  ],
  LTH_BOTTOMS: [
    { tier: 1, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 2, minDaily: 0, maxDaily: 1, expectedMode: 1 },
    { tier: 3, minDaily: 0, maxDaily: 2, expectedMode: 1 },
    { tier: 4, minDaily: 1, maxDaily: 3, expectedMode: 2 },
    { tier: 5, minDaily: 1, maxDaily: 4, expectedMode: 2 },
  ],
};

const QUALITIES: ProductQuality[] = ['STANDARD', 'PREMIUM', 'LUXURY'];

/**
 * Resolve L2 category node IDs from the database (so categoryL3Id satisfies the FK).
 * Run after product_category_nodes are seeded.
 */
async function getL2CodeToIdFromDb(): Promise<Map<string, string>> {
  const nodes = await prisma.productCategoryNode.findMany({
    where: {
      level: CategoryLevel.L2,
      code: { in: [...L2_CODES] },
      isActive: true,
    },
    select: { id: true, code: true },
  });
  const map = new Map<string, string>();
  for (const node of nodes) {
    map.set(node.code, node.id);
  }
  const missing = L2_CODES.filter((c) => !map.has(c));
  if (missing.length > 0) {
    throw new Error(
      `L2 category nodes missing in DB (seed product_category_nodes first): ${missing.join(', ')}`
    );
  }
  return map;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Seed ProductSalesBandConfig (L2 categories)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const l2CodeToId = await getL2CodeToIdFromDb();

  let created = 0;
  let updated = 0;

  for (const code of L2_CODES) {
    const categoryL3Id = l2CodeToId.get(code)!;
    const bands = BANDS[code]!;
    for (const band of bands) {
      const { tier, minDaily, maxDaily, expectedMode } = band;
      const tierMin = tier;
      const tierMax = tier;
      for (const productQuality of QUALITIES) {
        const existing = await prisma.productSalesBandConfig.findFirst({
          where: {
            categoryL3Id,
            productQuality,
            tierMin,
            tierMax,
            isActive: true,
          },
        });
        const payload = {
          minDaily,
          maxDaily,
          expectedMode,
          isActive: true,
        };
        if (existing) {
          await prisma.productSalesBandConfig.update({
            where: { id: existing.id },
            data: payload,
          });
          updated++;
        } else {
          await prisma.productSalesBandConfig.create({
            data: {
              categoryL3Id,
              productQuality,
              tierMin,
              tierMax,
              ...payload,
            },
          });
          created++;
        }
      }
    }
  }

  console.log(`ProductSalesBandConfig seed: ${created} created, ${updated} updated.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
