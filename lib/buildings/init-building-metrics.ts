/**
 * Initialize Building Metrics Helper
 * 
 * Creates BuildingMetricState rows for a building based on MetricLevelConfig and EconomyConfig.
 * Uses upsert pattern for idempotency - safe to call multiple times.
 */

import { BuildingRole, MetricType, CompanyBuilding } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  typeof import('@/lib/prisma').default,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Initialize BuildingMetricState for a building based on MetricLevelConfig at level 1.
 * 
 * For each MetricType defined in MetricLevelConfig for this building's role at level 1:
 * - Upserts a BuildingMetricState row with currentLevel=1
 * - Applies areaM2, rentPerMonthly, overheadMonthly from EconomyConfig if available
 * 
 * @param tx - Prisma transaction client
 * @param building - The CompanyBuilding to initialize metrics for
 * @returns Array of initialized metric states
 */
export async function initBuildingMetrics(
  tx: PrismaTransactionClient,
  building: CompanyBuilding
): Promise<void> {
  const buildingRole = building.role;
  const buildingId = building.id;

  // 1. Get all MetricTypes defined for this buildingRole at level 1
  const metricLevelConfigs = await tx.metricLevelConfig.findMany({
    where: {
      buildingRole,
      level: 1,
    },
    select: {
      metricType: true,
      effects: true,
    },
  });

  if (metricLevelConfigs.length === 0) {
    console.log(`No MetricLevelConfig found for ${buildingRole} at level 1`);
    return;
  }

  // 2. Get EconomyConfig for these metricTypes at level 1 (for areaM2, rent, overhead)
  const metricTypes = metricLevelConfigs.map((c) => c.metricType);
  
  const economyConfigs = await tx.economyConfig.findMany({
    where: {
      buildingRole,
      level: 1,
      metricType: { in: metricTypes },
    },
    select: {
      metricType: true,
      areaM2: true,
      rentPerMonthly: true,
      overheadMonthly: true,
    },
  });

  // Create a map for quick lookup
  const economyConfigMap = new Map(
    economyConfigs.map((ec) => [ec.metricType, ec])
  );

  // 3. Upsert BuildingMetricState for each metricType
  for (const mlc of metricLevelConfigs) {
    const metricType = mlc.metricType;
    const economyConfig = economyConfigMap.get(metricType);

    // Extract areaM2, rent, overhead from economyConfig if available
    const areaM2 = economyConfig?.areaM2 ?? 0;
    const rentPerMonthly = economyConfig?.rentPerMonthly ?? null;
    const overheadMonthly = economyConfig?.overheadMonthly ?? null;

    // Upsert the BuildingMetricState
    await tx.buildingMetricState.upsert({
      where: {
        buildingId_metricType: { buildingId, metricType },
      },
      create: {
        buildingId,
        metricType,
        currentLevel: 1,
        currentCount: 0,
        areaM2,
        rentPerMonthly,
        overheadMonthly,
        lastEvaluatedAt: null,
        lastUpgradedAt: null,
      },
      update: {}, // No-op if exists - don't overwrite existing state
    });
  }
}

/**
 * Initialize BuildingMetricState for multiple buildings.
 * 
 * @param tx - Prisma transaction client
 * @param buildings - Array of CompanyBuildings to initialize
 */
export async function initAllBuildingMetrics(
  tx: PrismaTransactionClient,
  buildings: CompanyBuilding[]
): Promise<void> {
  for (const building of buildings) {
    await initBuildingMetrics(tx, building);
  }
}

/**
 * Get setup costs from EconomyConfig for a building role at level 1.
 * 
 * @param tx - Prisma transaction client
 * @param buildingRole - Building role to get costs for
 * @returns Array of setup costs per metricType
 */
export async function getBuildingSetupCosts(
  tx: PrismaTransactionClient,
  buildingRole: BuildingRole
): Promise<Array<{
  metricType: MetricType;
  upgradeCostMoney: Decimal;
  awardXpOnUpgrade: number;
}>> {
  const configs = await tx.economyConfig.findMany({
    where: {
      buildingRole,
      level: 1,
    },
    select: {
      metricType: true,
      upgradeCostMoney: true,
      awardXpOnUpgrade: true,
    },
  });

  return configs;
}

/**
 * Get total setup cost for a building role at level 1.
 * 
 * @param tx - Prisma transaction client
 * @param buildingRole - Building role to get total cost for
 * @returns Total setup cost as Decimal
 */
export async function getBuildingTotalSetupCost(
  tx: PrismaTransactionClient,
  buildingRole: BuildingRole
): Promise<Decimal> {
  const costs = await getBuildingSetupCosts(tx, buildingRole);
  
  return costs.reduce(
    (sum, c) => sum.add(c.upgradeCostMoney),
    new Decimal(0)
  );
}
