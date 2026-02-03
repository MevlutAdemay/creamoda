/**
 * Marketing campaign cost helpers: package validation, SKU count, pricing rule multiplier, total price.
 * Used by campaign create APIs and pricing-preview endpoint.
 */

import type { PrismaClient } from '@prisma/client';
import { ListingStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export type MarketingScopeType = 'WAREHOUSE' | 'CATEGORY' | 'PRODUCT';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

export interface PackageWithPrice {
  id: string;
  scope: MarketingScopeType;
  key: string;
  title: string;
  description: string | null;
  durationDays: number;
  positiveBoostPct: number;
  negativeBoostPct: number;
  priceUsd: Decimal;
  isActive: boolean;
  sortIndex: number;
}

/**
 * Fetch package by id; ensure active and scope matches. Throws if not found or invalid.
 */
export async function getPackage(
  prisma: Tx,
  packageId: string,
  scope: MarketingScopeType
): Promise<PackageWithPrice> {
  const pkg = await (prisma as any).marketingPackageDefinition.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      scope: true,
      key: true,
      title: true,
      description: true,
      durationDays: true,
      positiveBoostPct: true,
      negativeBoostPct: true,
      priceUsd: true,
      isActive: true,
      sortIndex: true,
    },
  });
  if (!pkg || !pkg.isActive || pkg.scope !== scope) {
    throw new Error(`Package not found or invalid for scope ${scope}`);
  }
  return pkg as PackageWithPrice;
}

/**
 * Count LISTED ShowcaseListing for warehouse.
 */
export async function getWarehouseSkuCount(
  prisma: Tx,
  companyId: string,
  warehouseBuildingId: string
): Promise<number> {
  const count = await prisma.showcaseListing.count({
    where: {
      companyId,
      warehouseBuildingId,
      status: ListingStatus.LISTED,
    },
  });
  return count;
}

/**
 * Count LISTED listings in warehouse that belong to the given L2 category (template L3 -> parentId = categoryNodeId).
 */
export async function getCategorySkuCount(
  prisma: Tx,
  companyId: string,
  warehouseBuildingId: string,
  categoryNodeIdL2: string
): Promise<number> {
  const listings = await prisma.showcaseListing.findMany({
    where: {
      companyId,
      warehouseBuildingId,
      status: ListingStatus.LISTED,
    },
    select: { productTemplateId: true },
  });
  const templateIds = [...new Set(listings.map((l) => l.productTemplateId))];
  if (templateIds.length === 0) return 0;

  const templates = await prisma.productTemplate.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, categoryL3Id: true },
  });
  const l3Ids = [...new Set(templates.map((t) => t.categoryL3Id).filter(Boolean))] as string[];
  if (l3Ids.length === 0) return 0;

  const l3Nodes = await prisma.productCategoryNode.findMany({
    where: { id: { in: l3Ids } },
    select: { id: true, parentId: true },
  });
  const l3ToL2 = new Map(l3Nodes.map((n) => [n.id, n.parentId]).filter(([, p]) => p != null) as [string, string][]);

  const templateIdsInL2 = new Set(
    templates.filter((t) => t.categoryL3Id && l3ToL2.get(t.categoryL3Id) === categoryNodeIdL2).map((t) => t.id)
  );
  return listings.filter((l) => templateIdsInL2.has(l.productTemplateId)).length;
}

const DEFAULT_MULTIPLIER = '1.000';

/**
 * Find MarketingPricingRule for scope and skuCount: minSku <= skuCount and (maxSku is null or maxSku >= skuCount).
 * Choose smallest matching maxSku (order by maxSku asc nulls last). Default 1.000 if none.
 */
export async function getPricingMultiplier(
  prisma: Tx,
  scope: MarketingScopeType,
  skuCount: number
): Promise<string> {
  const rules = await (prisma as any).marketingPricingRule.findMany({
    where: {
      scope,
      isActive: true,
      minSku: { lte: skuCount },
      OR: [{ maxSku: { gte: skuCount } }, { maxSku: null }],
    },
    orderBy: [{ maxSku: 'asc' }, { sortIndex: 'asc' }],
    select: { multiplier: true },
    take: 1,
  });
  if (rules.length === 0) return DEFAULT_MULTIPLIER;
  const m = rules[0].multiplier;
  return m != null ? String(m) : DEFAULT_MULTIPLIER;
}

/**
 * totalPrice = basePriceUsd * multiplier (Decimal-safe).
 */
export function computeTotalPrice(basePriceUsd: Decimal | string, multiplierStr: string): Decimal {
  const base = typeof basePriceUsd === 'string' ? new Decimal(basePriceUsd) : basePriceUsd;
  const mult = new Decimal(multiplierStr);
  return base.mul(mult);
}
