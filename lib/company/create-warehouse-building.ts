/**
 * Create a single WAREHOUSE CompanyBuilding.
 * Caller must ensure (companyId, marketZone) does not already exist.
 */

import { BuildingRole, MarketZone, CompanyBuilding } from '@prisma/client';

type PrismaTransactionClient = Omit<
  typeof import('@/lib/prisma').default,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface CreateWarehouseBuildingParams {
  companyId: string;
  countryId: string;
  marketZone: MarketZone;
  name?: string | null;
}

/**
 * Creates one WAREHOUSE building. Fails if (companyId, marketZone) already exists.
 */
export async function createWarehouseBuilding(
  tx: PrismaTransactionClient,
  params: CreateWarehouseBuildingParams
): Promise<CompanyBuilding> {
  const { companyId, countryId, marketZone, name } = params;
  return tx.companyBuilding.create({
    data: {
      companyId,
      countryId,
      role: BuildingRole.WAREHOUSE,
      marketZone,
      name: name ?? `Warehouse - ${marketZone}`,
    },
  });
}
