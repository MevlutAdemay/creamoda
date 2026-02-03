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

export interface GetDesiredQtySeedContext {
  companyId: string;
  warehouseBuildingId: string;
  dayKey: Date;
}

/** Seed context for listing-level demand (includes playerProductId for deterministic jitter per product). */
export interface GetDesiredQtySeedContextForListing extends GetDesiredQtySeedContext {
  playerProductId?: string | null;
}

/** Deterministic float in [0, 1) from seed string (for jitter when seedContext is provided). */
function seededFloat(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h = h >>> 0;
  }
  return (h % 0x8000_0000) / 0x8000_0000;
}

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

export interface GetDesiredQtyMeta {
  desiredQty: number;
  bandMatched: boolean;
  resolvedBandCategoryId: string | null;
}

/**
 * Compute desired quantity with meta (bandMatched, resolvedBandCategoryId).
 * NOT used by run-warehouse-day-tick; the daily tick uses ShowcaseListing snapshot only.
 */
export async function getDesiredQtyWithMeta(
  productTemplateId: string,
  tier: number,
  tx: Tx,
  seedContext?: GetDesiredQtySeedContext
): Promise<GetDesiredQtyMeta> {
  const client = tx ?? prisma;
  const template = await client.productTemplate.findUnique({
    where: { id: productTemplateId },
    select: { categoryL3Id: true, productQuality: true },
  });
  if (!template) {
    return { desiredQty: 0, bandMatched: false, resolvedBandCategoryId: null };
  }

  let band = await findBand(client, template.categoryL3Id, template.productQuality, tier);
  let resolvedBandCategoryId: string | null = null;
  if (band) {
    resolvedBandCategoryId = template.categoryL3Id;
  } else {
    const node = await client.productCategoryNode.findUnique({
      where: { id: template.categoryL3Id },
      select: { level: true, parentId: true },
    });
    if (node?.level === CategoryLevel.L3 && node.parentId) {
      band = await findBand(client, node.parentId, template.productQuality, tier);
      if (band) resolvedBandCategoryId = node.parentId;
    }
  }

  const jitterFn = (value: number): number => jitter(value, seedContext, productTemplateId);

  if (!band) {
    const base = 1;
    const withJitter = base + jitterFn(base);
    const rounded = Math.max(0, Math.round(withJitter));
    const mult = getTestDemandMult();
    const desiredQty = mult != null ? Math.round(rounded * mult) : rounded;
    return { desiredQty, bandMatched: false, resolvedBandCategoryId: null };
  }

  const base =
    band.expectedMode ?? Math.round((band.minDaily + band.maxDaily) / 2);
  const potentialMultiplier = 1.0;
  const withPotential = base * potentialMultiplier;
  const withJitter = withPotential + jitterFn(withPotential);
  const rounded = Math.max(0, Math.round(withJitter));
  const mult = getTestDemandMult();
  const desiredQty = mult != null ? Math.round(rounded * mult) : rounded;
  return { desiredQty, bandMatched: true, resolvedBandCategoryId };
}

/**
 * Compute desired quantity for a product template for one day.
 * Uses ProductSalesBandConfig (band) + potential multiplier (1.0 for now) + jitter.
 * When seedContext is provided, jitter is deterministic per (companyId, warehouseBuildingId, dayKey, productTemplateId).
 * If template points to L3 category, band lookup is tried by L3 id then by parent L2 id when bands are keyed by L2.
 *
 * @param productTemplateId - Product template ID
 * @param tier - Tier for band lookup (1..5; use warehouse SALES_COUNT currentLevel). Default 0 for backward compat.
 * @param tx - Optional transaction client (use inside runWarehouseDayTick transaction)
 * @param seedContext - Optional context for deterministic jitter (companyId, warehouseBuildingId, dayKey)
 * @returns desiredQty (integer >= 0)
 */
export async function getDesiredQty(
  productTemplateId: string,
  tier: number = DEFAULT_TIER,
  tx?: Tx,
  seedContext?: GetDesiredQtySeedContext
): Promise<number> {
  if (tx) {
    const meta = await getDesiredQtyWithMeta(productTemplateId, tier, tx, seedContext);
    return meta.desiredQty;
  }
  const client = prisma;
  const template = await client.productTemplate.findUnique({
    where: { id: productTemplateId },
    select: { categoryL3Id: true, productQuality: true },
  });
  if (!template) return 0;

  let band = await findBand(client, template.categoryL3Id, template.productQuality, tier);
  if (!band) {
    const node = await client.productCategoryNode.findUnique({
      where: { id: template.categoryL3Id },
      select: { level: true, parentId: true },
    });
    if (node?.level === CategoryLevel.L3 && node.parentId) {
      band = await findBand(client, node.parentId, template.productQuality, tier);
    }
  }

  const jitterFn = (value: number): number => jitter(value, seedContext, productTemplateId);
  if (!band) {
    const base = 1;
    const withJitter = base + jitterFn(base);
    const rounded = Math.max(0, Math.round(withJitter));
    const mult = getTestDemandMult();
    return mult != null ? Math.round(rounded * mult) : rounded;
  }
  const base =
    band.expectedMode ?? Math.round((band.minDaily + band.maxDaily) / 2);
  const withPotential = base * 1.0;
  const withJitter = withPotential + jitterFn(withPotential);
  const rounded = Math.max(0, Math.round(withJitter));
  const mult = getTestDemandMult();
  return mult != null ? Math.round(rounded * mult) : rounded;
}

/**
 * Jitter: ±JITTER_FRACTION of value (uniform).
 * When seedContext is provided, uses deterministic float from hash(companyId, warehouseBuildingId, dayKey, productTemplateId).
 */
function jitter(
  value: number,
  seedContext?: GetDesiredQtySeedContext,
  productTemplateId?: string
): number {
  const range = value * JITTER_FRACTION;
  if (seedContext && productTemplateId) {
    const dayKeyStr = seedContext.dayKey.toISOString().slice(0, 10);
    const seed = `${seedContext.companyId}:${seedContext.warehouseBuildingId}:${dayKeyStr}:${productTemplateId}`;
    const t = seededFloat(seed);
    return (t * 2 - 1) * range;
  }
  return (Math.random() * 2 - 1) * range;
}

const LISTING_JITTER_FRACTION = 0.05;

/**
 * Jitter with explicit fraction (e.g. ±5% for modelRank-based demand).
 * Deterministic when seedContext and productTemplateId provided; seed includes playerProductId.
 */
function jitterWithFraction(
  value: number,
  fraction: number,
  seedContext: GetDesiredQtySeedContextForListing,
  productTemplateId: string
): number {
  const range = value * fraction;
  const dayKeyStr = seedContext.dayKey.toISOString().slice(0, 10);
  const seed = `${seedContext.companyId}:${seedContext.warehouseBuildingId}:${dayKeyStr}:${productTemplateId}:${seedContext.playerProductId ?? ''}`;
  const t = seededFloat(seed);
  return (t * 2 - 1) * range;
}

export interface GetDesiredQtyWithMetaForListingResult {
  desiredQty: number;
  bandMatched: boolean;
  resolvedBandCategoryId: string | null;
  minDaily: number | null;
  maxDaily: number | null;
  baseUnits: number | null;
  modelRankUsed: number;
  jitterFractionUsed: number;
}

/**
 * Compute desired quantity for a listing using PlayerProduct.modelRank mapped onto band minDaily/maxDaily.
 * Uses ±5% deterministic jitter. Does not use expectedMode.
 */
export async function getDesiredQtyWithMetaForListing(
  productTemplateId: string,
  tier: number,
  tx: Tx,
  seedContext: GetDesiredQtySeedContextForListing,
  modelRank?: number
): Promise<GetDesiredQtyWithMetaForListingResult> {
  const client = tx ?? prisma;
  const template = await client.productTemplate.findUnique({
    where: { id: productTemplateId },
    select: { categoryL3Id: true, productQuality: true },
  });
  const modelRankUsed = Math.min(1, Math.max(0, modelRank ?? 0.5));
  const jitterFractionUsed = LISTING_JITTER_FRACTION;

  if (!template) {
    return {
      desiredQty: 0,
      bandMatched: false,
      resolvedBandCategoryId: null,
      minDaily: null,
      maxDaily: null,
      baseUnits: null,
      modelRankUsed,
      jitterFractionUsed,
    };
  }

  let band = await findBand(client, template.categoryL3Id, template.productQuality, tier);
  let resolvedBandCategoryId: string | null = null;
  if (band) {
    resolvedBandCategoryId = template.categoryL3Id;
  } else {
    const node = await client.productCategoryNode.findUnique({
      where: { id: template.categoryL3Id },
      select: { level: true, parentId: true },
    });
    if (node?.level === CategoryLevel.L3 && node.parentId) {
      band = await findBand(client, node.parentId, template.productQuality, tier);
      if (band) resolvedBandCategoryId = node.parentId;
    }
  }

  if (!band) {
    const baseUnits = 1;
    const withJitter = baseUnits + jitterWithFraction(baseUnits, jitterFractionUsed, seedContext, productTemplateId);
    const desiredQty = Math.max(0, Math.round(withJitter));
    return {
      desiredQty,
      bandMatched: false,
      resolvedBandCategoryId: null,
      minDaily: null,
      maxDaily: null,
      baseUnits,
      modelRankUsed,
      jitterFractionUsed,
    };
  }

  const minDaily = band.minDaily;
  const maxDaily = band.maxDaily;
  const baseUnitsRaw = minDaily + (maxDaily - minDaily) * modelRankUsed;
  const baseUnits = Math.round(baseUnitsRaw);
  const withJitter = baseUnits + jitterWithFraction(baseUnits, jitterFractionUsed, seedContext, productTemplateId);
  const desiredQty = Math.max(0, Math.round(withJitter));

  return {
    desiredQty,
    bandMatched: true,
    resolvedBandCategoryId,
    minDaily,
    maxDaily,
    baseUnits,
    modelRankUsed,
    jitterFractionUsed,
  };
}
