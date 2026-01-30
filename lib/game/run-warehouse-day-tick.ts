/**
 * Warehouse day tick: order generation (Step A) + fulfillment (Step B).
 * Step A: idempotent per (warehouse, dayKey); orders from LISTED listings only; no stock change (order items created with qtyOrdered); DailyProductSalesLog; auto-pause out-of-stock.
 * Step B: FIFO backlog; on fulfill create OUT movements (positive qtyChange, SALES_FULFILLMENT) and decrease qtyOnHand; capacity from BuildingMetricState + MetricLevelConfig; partial fills; DailyProductSalesLog qtyShipped.
 */

import prisma from '@/lib/prisma';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';
import { getDesiredQty } from '@/lib/game/demand';
import { InventoryMovementType, InventorySourceType, ListingStatus, ListingPausedReason, BuildingRole, MetricType } from '@prisma/client';

/**
 * Run warehouse day tick for a single warehouse and day.
 * Step A: generate daily order from LISTED listings (if not already present); create order items with qtyOrdered = min(desired, qtyOnHand); no inventory or OUT movements.
 * Step B: fulfill backlog up to daily capacity (FIFO); when fulfilling create InventoryMovement OUT (positive qtyChange, SALES_FULFILLMENT) and decrease BuildingInventoryItem.qtyOnHand.
 */
export async function runWarehouseDayTick(
  companyId: string,
  warehouseBuildingId: string,
  dayKey: Date
): Promise<{ orderCreated: boolean; itemsFulfilled: number }> {
  const normalizedDayKey = normalizeUtcMidnight(dayKey);

  let orderCreated = false;
  let itemsFulfilled = 0;

  await prisma.$transaction(async (tx) => {
    // --- Step A: Order generation (idempotent per warehouse + dayKey) ---
    const existingOrder = await tx.modaverseOrder.findUnique({
      where: {
        warehouseBuildingId_dayKey: {
          warehouseBuildingId,
          dayKey: normalizedDayKey,
        },
      },
    });

    if (!existingOrder) {
      // Only LISTED listings for this warehouse
      const listings = await tx.showcaseListing.findMany({
        where: {
          companyId,
          warehouseBuildingId,
          status: ListingStatus.LISTED,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          productTemplateId: true,
          playerProductId: true,
          salePrice: true,
          listPrice: true,
          marketZone: true,
        },
      });

      const order = await tx.modaverseOrder.create({
        data: {
          companyId,
          warehouseBuildingId,
          dayKey: normalizedDayKey,
        },
      });

      let sortIndex = 1;
      for (const listing of listings) {
        const inv = await tx.buildingInventoryItem.findUnique({
          where: {
            companyBuildingId_productTemplateId: {
              companyBuildingId: warehouseBuildingId,
              productTemplateId: listing.productTemplateId,
            },
          },
          select: { id: true, qtyOnHand: true, avgUnitCost: true },
        });

        if (!inv || inv.qtyOnHand <= 0) {
          await tx.showcaseListing.update({
            where: { id: listing.id },
            data: {
              status: ListingStatus.PAUSED,
              pausedReason: ListingPausedReason.OUT_OF_STOCK,
              pausedAt: new Date(),
            },
          });
          continue;
        }

        const desired = await getDesiredQty(listing.productTemplateId, 0, tx);
        const orderedQty = Math.min(desired, inv.qtyOnHand);
        if (orderedQty < 0) {
          throw new Error(`orderedQty must not be negative (listing=${listing.id}, desired=${desired}, qtyOnHand=${inv.qtyOnHand})`);
        }
        if (orderedQty === 0) {
          continue; // skip: no DB writes — no ModaverseOrderItem or DailyProductSalesLog; do not consume sortIndex
        }

        // Step A: no stock decrement or OUT movement here; those happen at fulfillment (Step B)

        await tx.modaverseOrderItem.create({
          data: {
            orderId: order.id,
            listingId: listing.id,
            productTemplateId: listing.productTemplateId,
            playerProductId: listing.playerProductId,
            qtyOrdered: orderedQty,
            qtyFulfilled: 0,
            qtyShipped: 0,
            sortIndex,
            salePriceUsd: listing.salePrice,
          },
        });

        await tx.dailyProductSalesLog.upsert({
          where: {
            listingId_dayKey: { listingId: listing.id, dayKey: normalizedDayKey },
          },
          create: {
            companyId,
            listingId: listing.id,
            marketZone: listing.marketZone,
            warehouseBuildingId,
            productTemplateId: listing.productTemplateId,
            playerProductId: listing.playerProductId,
            dayKey: normalizedDayKey,
            qtyOrdered: orderedQty,
            qtyShipped: 0,
            salePrice: listing.salePrice,
            listPrice: listing.listPrice,
          },
          update: {
            qtyOrdered: { increment: orderedQty },
            salePrice: listing.salePrice,
            listPrice: listing.listPrice,
          },
        });

        const newQtyOnHand = inv.qtyOnHand - orderedQty;
        if (newQtyOnHand === 0) {
          await tx.showcaseListing.update({
            where: { id: listing.id },
            data: {
              status: ListingStatus.PAUSED,
              pausedReason: ListingPausedReason.OUT_OF_STOCK,
              pausedAt: new Date(),
            },
          });
        }

        sortIndex += 1;
      }
      orderCreated = true;
    }

    // --- Step B: Fulfillment (capacity, FIFO, partial fills); create OUT movements (positive qtyChange) and decrease qtyOnHand ---
    const metricState = await tx.buildingMetricState.findUnique({
      where: {
        buildingId_metricType: {
          buildingId: warehouseBuildingId,
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
    const capacity = levelConfig?.maxAllowed ?? 0;

    const backlogItemsRaw = await tx.modaverseOrderItem.findMany({
      where: { order: { warehouseBuildingId, companyId } },
      include: { order: { select: { dayKey: true } } },
      orderBy: [{ order: { dayKey: 'asc' } }, { sortIndex: 'asc' }],
    });
    const backlogItems = backlogItemsRaw.filter((i) => i.qtyFulfilled < i.qtyOrdered);

    let remainingCapacity = capacity;
    for (const item of backlogItems) {
      if (remainingCapacity <= 0) break;
      const remaining = item.qtyOrdered - item.qtyFulfilled;
      if (remaining <= 0) continue;

      const inv = await tx.buildingInventoryItem.findUnique({
        where: {
          companyBuildingId_productTemplateId: {
            companyBuildingId: warehouseBuildingId,
            productTemplateId: item.productTemplateId,
          },
        },
        select: { id: true, qtyOnHand: true, avgUnitCost: true },
      });
      const available = inv?.qtyOnHand ?? 0;
      const ship = Math.min(remaining, remainingCapacity, available);
      if (ship <= 0) continue;

      await tx.buildingInventoryItem.update({
        where: { id: inv!.id },
        data: { qtyOnHand: { decrement: ship } },
      });

      await tx.inventoryMovement.create({
        data: {
          companyBuildingId: warehouseBuildingId,
          productTemplateId: item.productTemplateId,
          playerProductId: item.playerProductId ?? undefined,
          movementType: InventoryMovementType.OUT,
          sourceType: InventorySourceType.SALES_FULFILLMENT,
          sourceRefId: item.orderId,
          qtyChange: ship,
          unitCost: inv!.avgUnitCost,
          dayKey: normalizedDayKey,
        },
      });

      await tx.modaverseOrderItem.update({
        where: { id: item.id },
        data: {
          qtyFulfilled: { increment: ship },
          qtyShipped: { increment: ship },
        },
      });
      remainingCapacity -= ship;
      itemsFulfilled += 1;

      if (item.listingId) {
        const listingForLog = await tx.showcaseListing.findUnique({
          where: { id: item.listingId },
          select: { marketZone: true, companyId: true },
        });
        await tx.dailyProductSalesLog.upsert({
          where: {
            listingId_dayKey: { listingId: item.listingId, dayKey: normalizedDayKey },
          },
          create: {
            companyId: listingForLog?.companyId ?? companyId,
            listingId: item.listingId,
            marketZone: listingForLog?.marketZone ?? 'USA',
            warehouseBuildingId,
            productTemplateId: item.productTemplateId,
            playerProductId: item.playerProductId ?? undefined,
            dayKey: normalizedDayKey,
            qtyOrdered: 0,
            qtyShipped: ship,
          },
          update: { qtyShipped: { increment: ship } },
        });
      }

      const newQtyOnHand = available - ship;
      if (newQtyOnHand === 0 && item.listingId) {
        await tx.showcaseListing.update({
          where: { id: item.listingId },
          data: {
            status: ListingStatus.PAUSED,
            pausedReason: ListingPausedReason.OUT_OF_STOCK,
            pausedAt: new Date(),
          },
        });
      }
    }
  });

  return { orderCreated, itemsFulfilled };
}
