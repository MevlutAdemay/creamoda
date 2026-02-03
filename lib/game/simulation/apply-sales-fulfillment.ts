/**
 * Sales fulfillment (Step B style): ship from reserved/on-hand inventory for a given day.
 * Used by test scripts and any flow that reserves first then fulfills.
 */

import type { PrismaClient } from '@prisma/client';
import { BuildingRole, MetricType, InventoryMovementType, InventorySourceType } from '@prisma/client';

function parseDayKey(dayKey: string): Date {
  const d = new Date(dayKey + 'T00:00:00.000Z');
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type ApplySalesFulfillmentResult = {
  shippedUnits: number;
  backlogUnits: number;
  shippedLines: number;
  capacityUsed: number;
  capacityTotal: number;
  wasIdempotent: boolean;
};

/**
 * Run fulfillment for the given warehouse and dayKey: ship from backlog (qtyOrdered - qtyShipped)
 * up to capacity, decrementing qtyOnHand and qtyReserved on inventory.
 */
export async function applySalesFulfillment(
  prisma: PrismaClient,
  companyId: string,
  warehouseId: string,
  dayKey: string
): Promise<ApplySalesFulfillmentResult> {
  const dayKeyDate = parseDayKey(dayKey);

  let shippedUnits = 0;
  let backlogUnits = 0;
  let shippedLines = 0;
  let capacityUsed = 0;
  let capacityTotal = 0;
  let wasIdempotent = true;

  await prisma.$transaction(async (tx) => {
    const metricState = await tx.buildingMetricState.findUnique({
      where: {
        buildingId_metricType: {
          buildingId: warehouseId,
          metricType: MetricType.SALES_COUNT,
        },
      },
      select: { currentLevel: true },
    });
    const currentLevel = metricState?.currentLevel ?? 1;
    const levelConfig = await tx.metricLevelConfig.findUnique({
      where: {
        buildingRole_metricType_level: {
          buildingRole: BuildingRole.WAREHOUSE,
          metricType: MetricType.SALES_COUNT,
          level: currentLevel,
        },
      },
      select: { maxAllowed: true },
    });
    capacityTotal = levelConfig?.maxAllowed ?? 0;
    let remainingCapacity = capacityTotal;

    const logsRaw = await tx.dailyProductSalesLog.findMany({
      where: {
        warehouseBuildingId: warehouseId,
        dayKey: dayKeyDate,
      },
      orderBy: { listingKey: 'asc' },
    });
    const logs = logsRaw.filter((l) => l.qtyShipped < l.qtyOrdered);

    for (const log of logs) {
      const toShip = log.qtyOrdered - log.qtyShipped;
      if (toShip <= 0 || remainingCapacity <= 0) continue;

      const inv = await tx.buildingInventoryItem.findUnique({
        where: {
          companyBuildingId_productTemplateId: {
            companyBuildingId: warehouseId,
            productTemplateId: log.productTemplateId,
          },
        },
        select: { id: true, qtyOnHand: true, qtyReserved: true, avgUnitCost: true },
      });
      const available = inv ? Math.min(inv.qtyOnHand, inv.qtyReserved, toShip) : 0;
      const ship = Math.min(toShip, remainingCapacity, available);
      if (ship <= 0) continue;

      await tx.buildingInventoryItem.update({
        where: { id: inv!.id },
        data: {
          qtyOnHand: { decrement: ship },
          qtyReserved: { decrement: ship },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          companyBuildingId: warehouseId,
          productTemplateId: log.productTemplateId,
          playerProductId: log.playerProductId,
          movementType: InventoryMovementType.OUT,
          sourceType: InventorySourceType.SALES_FULFILLMENT,
          sourceRefId: log.id,
          qtyChange: ship,
          unitCost: inv!.avgUnitCost,
          dayKey: dayKeyDate,
        },
      });

      await tx.dailyProductSalesLog.update({
        where: { id: log.id },
        data: { qtyShipped: { increment: ship } },
      });

      shippedUnits += ship;
      shippedLines += 1;
      capacityUsed += ship;
      remainingCapacity -= ship;
      wasIdempotent = false;
    }

    const afterLogs = await tx.dailyProductSalesLog.findMany({
      where: {
        warehouseBuildingId: warehouseId,
        dayKey: dayKeyDate,
      },
      select: { qtyOrdered: true, qtyShipped: true },
    });
    backlogUnits = afterLogs.reduce((sum, r) => sum + (r.qtyOrdered - r.qtyShipped), 0);
  });

  return {
    shippedUnits,
    backlogUnits,
    shippedLines,
    capacityUsed,
    capacityTotal,
    wasIdempotent,
  };
}

/**
 * Sum of (qtyOrdered - qtyShipped) across all DailyProductSalesLog rows for the warehouse.
 */
export async function getWarehouseBacklog(
  prisma: PrismaClient,
  warehouseId: string
): Promise<number> {
  const rows = await prisma.dailyProductSalesLog.findMany({
    where: { warehouseBuildingId: warehouseId },
    select: { qtyOrdered: true, qtyShipped: true },
  });
  return rows.reduce((sum, r) => sum + (r.qtyOrdered - r.qtyShipped), 0);
}
