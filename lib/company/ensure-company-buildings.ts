/**
 * Ensure Company Buildings Helper
 * 
 * Creates required company buildings (HQ + WAREHOUSE) idempotently.
 * Uses upsert pattern to avoid duplicate violations on retry.
 */

import { BuildingRole, MarketZone, CompanyBuilding } from '@prisma/client';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  typeof import('@/lib/prisma').default,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Default MarketZone fallback if country doesn't have one set.
 * TODO: Consider requiring marketZone selection in UI for countries without it.
 */
const DEFAULT_MARKET_ZONE = MarketZone.EU_CENTRAL;

export interface EnsureCompanyBuildingsParams {
  companyId: string;
  countryId: string;
}

export interface EnsureCompanyBuildingsResult {
  hqBuilding: CompanyBuilding;
  warehouseBuilding: CompanyBuilding;
}

/**
 * Ensures that required company buildings exist.
 * Creates HQ and WAREHOUSE buildings if they don't exist.
 * 
 * Uses upsert pattern for idempotency - safe to call multiple times.
 * 
 * @param tx - Prisma transaction client
 * @param params - Company ID and country ID for marketZone derivation
 * @returns Created or existing HQ and WAREHOUSE buildings
 */
export async function ensureCompanyBuildings(
  tx: PrismaTransactionClient,
  params: EnsureCompanyBuildingsParams
): Promise<EnsureCompanyBuildingsResult> {
  const { companyId, countryId } = params;

  // 1. Get country's marketZone for WAREHOUSE
  const country = await tx.country.findUnique({
    where: { id: countryId },
    select: { marketZone: true, name: true },
  });

  if (!country) {
    throw new Error(`Country not found: ${countryId}`);
  }

  // Derive marketZone from country, fallback to default if not set
  const warehouseMarketZone = country.marketZone || DEFAULT_MARKET_ZONE;

  // 2. HQ: şirket başına tek (uygulama ile); yoksa oluştur
  let hqBuilding = await tx.companyBuilding.findFirst({
    where: { companyId, role: BuildingRole.HQ },
  });
  if (!hqBuilding) {
    hqBuilding = await tx.companyBuilding.create({
      data: {
        companyId,
        countryId,
        role: BuildingRole.HQ,
        marketZone: null,
        name: 'Headquarters',
      },
    });
  } else if (hqBuilding.countryId !== countryId) {
    hqBuilding = await tx.companyBuilding.update({
      where: { id: hqBuilding.id },
      data: { countryId },
    });
  }

  // 3. WAREHOUSE: bu marketZone için yoksa oluştur (wizard idempotent)
  let warehouseBuilding = await tx.companyBuilding.findFirst({
    where: {
      companyId,
      role: BuildingRole.WAREHOUSE,
      marketZone: warehouseMarketZone,
    },
  });
  if (!warehouseBuilding) {
    warehouseBuilding = await tx.companyBuilding.create({
      data: {
        companyId,
        countryId,
        role: BuildingRole.WAREHOUSE,
        marketZone: warehouseMarketZone,
        name: `Warehouse - ${warehouseMarketZone}`,
      },
    });
  } else if (warehouseBuilding.countryId !== countryId) {
    warehouseBuilding = await tx.companyBuilding.update({
      where: { id: warehouseBuilding.id },
      data: { countryId },
    });
  }

  return {
    hqBuilding,
    warehouseBuilding,
  };
}

/**
 * Get company buildings (HQ and WAREHOUSE) if they exist.
 * Returns null for any building that doesn't exist.
 * 
 * @param tx - Prisma transaction client  
 * @param companyId - Company ID
 * @returns Buildings or null for each
 */
export async function getCompanyBuildings(
  tx: PrismaTransactionClient,
  companyId: string
): Promise<{
  hqBuilding: CompanyBuilding | null;
  warehouseBuilding: CompanyBuilding | null;
}> {
  const buildings = await tx.companyBuilding.findMany({
    where: { companyId },
  });

  return {
    hqBuilding: buildings.find((b) => b.role === BuildingRole.HQ) || null,
    warehouseBuilding: buildings.find((b) => b.role === BuildingRole.WAREHOUSE) || null,
  };
}
