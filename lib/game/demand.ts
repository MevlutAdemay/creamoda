/**
 * Product-potential based demand (desiredQty).
 * Band (category/quality/tier) + potential multiplier + bots/random jitter.
 * No traffic-based demand (no visitors/impressions/clicks).
 *
 * Test-only: MODAVERSE_TEST_DEMAND_MULT (integer > 1) scales desiredQty for backlog testing.
 */

import prisma from '@/lib/prisma';
import { CategoryLevel } from '@prisma/client';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const DEFAULT_TIER = 0;
const JITTER_FRACTION = 0.15; // ±15% random jitter

function getTestDemandMult(): number | null {
  const raw = process.env.MODAVERSE_TEST_DEMAND_MULT;
  if (raw == null || raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n < 2 ? null : n;
}

type BandResult = { minDaily: number; maxDaily: number; expectedMode: number | null } | null;

async function findBand(
  client: Tx,
  categoryId: string,
  productQuality: string,
  tier: number
): Promise<BandResult> {
  return client.productSalesBandConfig.findFirst({
    where: {
      categoryL3Id: categoryId,
      productQuality: productQuality as 'STANDARD' | 'PREMIUM' | 'LUXURY',
      isActive: true,
      tierMin: { lte: tier },
      tierMax: { gte: tier },
    },
    select: { minDaily: true, maxDaily: true, expectedMode: true },
  });
}

/**
 * Compute desired quantity for a product template for one day.
 * Uses ProductSalesBandConfig (band) + potential multiplier (1.0 for now) + random jitter.
 * If template points to L3 category, band lookup is tried by L3 id then by parent L2 id when bands are keyed by L2.
 *
 * @param productTemplateId - Product template ID
 * @param tier - Optional tier for band lookup (e.g. HQ sales count bracket); defaults to 0
 * @param tx - Optional transaction client (use inside runWarehouseDayTick transaction)
 * @returns desiredQty (integer >= 0)
 */
export async function getDesiredQty(
  productTemplateId: string,
  tier: number = DEFAULT_TIER,
  tx?: Tx
): Promise<number> {
  const client = tx ?? prisma;
  const template = await client.productTemplate.findUnique({
    where: { id: productTemplateId },
    select: { categoryL3Id: true, productQuality: true },
  });
  if (!template) return 0;

  let band = await findBand(
    client,
    template.categoryL3Id,
    template.productQuality,
    tier
  );

  if (!band) {
    const node = await client.productCategoryNode.findUnique({
      where: { id: template.categoryL3Id },
      select: { level: true, parentId: true },
    });
    if (node?.level === CategoryLevel.L3 && node.parentId) {
      band = await findBand(client, node.parentId, template.productQuality, tier);
    }
  }

  if (!band) {
    // No band config: use a small baseline + jitter
    const base = 1;
    const withJitter = base + jitter(base);
    const rounded = Math.max(0, Math.round(withJitter));
    const mult = getTestDemandMult();
    return mult != null ? Math.round(rounded * mult) : rounded;
  }

  const base =
    band.expectedMode ?? Math.round((band.minDaily + band.maxDaily) / 2);
  const potentialMultiplier = 1.0; // Can plug season/hemisphere later
  const withPotential = base * potentialMultiplier;
  const withJitter = withPotential + jitter(withPotential);
  const rounded = Math.max(0, Math.round(withJitter));
  const mult = getTestDemandMult();
  return mult != null ? Math.round(rounded * mult) : rounded;
}

/**
 * Random jitter: ±JITTER_FRACTION of value (uniform).
 */
function jitter(value: number): number {
  const range = value * JITTER_FRACTION;
  return (Math.random() * 2 - 1) * range;
}
