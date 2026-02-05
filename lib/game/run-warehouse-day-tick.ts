// lib/game/run-warehouse-day-tick.ts

/**
 * Warehouse day tick: order generation (Step A) + fulfillment (Step B).
 * Step A: idempotent per (warehouse, dayKey); orders from LISTED listings only; uses listing snapshot (baseQty, price, season); DailyProductSalesLog upserted for every LISTED listing (even when orderedQty=0); out-of-stock deletes listing.
 * Step B: FIFO backlog; on fulfill create OUT movements (positive qtyChange, SALES_FULFILLMENT) and decrease qtyOnHand; DailyProductSalesLog by listingKey_dayKey; out-of-stock deletes listing.
 */

import prisma from '@/lib/prisma';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';
import { applyWarehouseMarketing } from '@/lib/game/apply-warehouse-marketing';
import { applyCategoryMarketing } from '@/lib/game/apply-category-marketing';
import { applyProductMarketing } from '@/lib/game/apply-product-marketing';
import { InventoryMovementType, InventorySourceType, ListingStatus, BuildingRole, MetricType, MarketZone } from '@prisma/client';

/**
 * Run warehouse day tick for a single warehouse and day.
 * Step A: generate daily order from LISTED listings using snapshot only; upsert DailyProductSalesLog for every listing; create order items only when orderedQty > 0; delete listing when OOS.
 * Step B: fulfill backlog; upsert log by listingKey_dayKey; delete listing when OOS.
 */
export async function runWarehouseDayTick(
  companyId: string,
  warehouseBuildingId: string,
  dayKey: Date
): Promise<{ orderCreated: boolean; itemsFulfilled: number }> {
  const normalizedDayKey = normalizeUtcMidnight(dayKey);

  let orderCreated = false;
  let itemsFulfilled = 0;

  await prisma.$transaction(
    async (tx) => {
    // Apply warehouse, category, then product marketing to LISTED listings before Step A (writes positiveBoostPct / negativeBoostPct)
    await applyWarehouseMarketing(tx, companyId, warehouseBuildingId, normalizedDayKey);
    await applyCategoryMarketing(tx, companyId, warehouseBuildingId, normalizedDayKey);
    await applyProductMarketing(tx, companyId, warehouseBuildingId, normalizedDayKey);

    // --- Step A: Order generation (idempotent per warehouse + dayKey) ---
    const existingOrder = await tx.modaverseOrder.findUnique({
      where: {
        warehouseBuildingId_dayKey: {
          warehouseBuildingId,
          dayKey: normalizedDayKey,
        },
      },
    });

    const warehouse = await tx.companyBuilding.findUnique({
      where: { id: warehouseBuildingId },
      select: { marketZone: true },
    });
    const warehouseMarketZone: MarketZone = warehouse?.marketZone ?? 'USA';

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
        baseQty: true,
        baseMinDaily: true,
        baseMaxDaily: true,
        tierUsed: true,
        positiveBoostPct: true,
        negativeBoostPct: true,
        priceIndex: true,
        priceMultiplier: true,
        blockedByPrice: true,
        seasonScore: true,
        blockedBySeason: true,
      },
    });

    const templateIds = [...new Set(listings.map((l) => l.productTemplateId))];
    const inventoryItems = await tx.buildingInventoryItem.findMany({
      where: {
        companyBuildingId: warehouseBuildingId,
        productTemplateId: { in: templateIds },
      },
      select: { productTemplateId: true, id: true, qtyOnHand: true, avgUnitCost: true },
    });
    const invMap = new Map(inventoryItems.map((i) => [i.productTemplateId, i]));

    const awarenessState = await (tx as any).warehouseAwarenessState.findUnique({
      where: { warehouseBuildingId },
      select: { awareness: true },
    });
    const awarenessRaw = awarenessState?.awareness ?? 0;
    const awarenessNum = Number(awarenessRaw);
    const awarenessClamped = Math.min(0.5, Math.max(0, awarenessNum));
    const awarenessMultiplier = 1 + awarenessClamped;

    type StepAItem = {
      listing: (typeof listings)[number];
      inv: (typeof inventoryItems)[number] | null;
      baseDesired: number;
      expectedUnits: number;
      unitsAfterBoost: number;
      unitsAfterPrice: number;
      seasonScore: number;
      seasonMultiplier: number;
      blockedBySeason: boolean;
      finalUnits: number;
      finalDesired: number;
      orderedQty: number;
      priceMultiplier: number;
      blockedByPrice: boolean;
      missingBaseQty: boolean;
    };

    const stepAItems: StepAItem[] = [];

    for (const listing of listings) {
      const inv = invMap.get(listing.productTemplateId) ?? null;
      const qtyOnHand = inv?.qtyOnHand ?? 0;

      const baseDesired = listing.baseQty ?? 0;
      const missingBaseQty = listing.baseQty == null;
      const expectedUnits = baseDesired;

      const posPct = listing.positiveBoostPct ?? 0;
      const negPct = listing.negativeBoostPct ?? 0;
      const posMul = 1 + posPct / 100;
      const negMul = Math.max(0, 1 - negPct / 100);
      const unitsAfterBoost = expectedUnits * posMul * negMul;

      const priceMultiplier = listing.priceMultiplier != null ? listing.priceMultiplier : 1;
      const blockedByPrice = listing.blockedByPrice ?? false;
      const unitsAfterPrice = unitsAfterBoost * priceMultiplier;

      const seasonScore = listing.seasonScore ?? 100;
      const seasonMultiplier = seasonScore / 100;
      const blockedBySeason = seasonScore === 0;

      let finalUnits = unitsAfterPrice * seasonMultiplier;
      if (blockedBySeason) finalUnits = 0;
      finalUnits *= awarenessMultiplier;
      const finalDesired = Math.round(finalUnits);
      const orderedQty = Math.min(finalDesired, qtyOnHand);
      if (orderedQty < 0) {
        throw new Error(`orderedQty must not be negative (listing=${listing.id})`);
      }

      stepAItems.push({
        listing,
        inv,
        baseDesired,
        expectedUnits,
        unitsAfterBoost,
        unitsAfterPrice,
        seasonScore,
        seasonMultiplier,
        blockedBySeason,
        finalUnits,
        finalDesired,
        orderedQty,
        priceMultiplier,
        blockedByPrice,
        missingBaseQty,
      });
    }

    // Always: upsert DailyProductSalesLog for every LISTED listing (even when order already exists or orderedQty=0)
    for (const item of stepAItems) {
      const reasonsSnapshot = {
        baseDesired: item.baseDesired,
        expectedUnits: item.expectedUnits,
        unitsAfterBoost: item.unitsAfterBoost,
        unitsAfterPrice: item.unitsAfterPrice,
        finalUnits: item.finalUnits,
        tierUsed: item.listing.tierUsed,
        baseMinDaily: item.listing.baseMinDaily,
        baseMaxDaily: item.listing.baseMaxDaily,
        baseQty: item.listing.baseQty,
        positiveBoostPct: item.listing.positiveBoostPct,
        negativeBoostPct: item.listing.negativeBoostPct,
        priceIndex: item.listing.priceIndex,
        priceMultiplier: item.priceMultiplier,
        blockedByPrice: item.blockedByPrice,
        seasonScore: item.seasonScore,
        seasonMultiplier: item.seasonMultiplier,
        blockedBySeason: item.blockedBySeason,
        ...(item.missingBaseQty ? { missingBaseQty: true } : {}),
      };

      await tx.dailyProductSalesLog.upsert({
        where: {
          listingKey_dayKey: {
            listingKey: item.listing.id,
            dayKey: normalizedDayKey,
          },
        },
        create: {
          companyId,
          listingKey: item.listing.id,
          listingId: item.listing.id,
          marketZone: warehouseMarketZone,
          warehouseBuildingId,
          productTemplateId: item.listing.productTemplateId,
          playerProductId: item.listing.playerProductId,
          dayKey: normalizedDayKey,
          qtyOrdered: item.orderedQty,
          qtyShipped: 0,
          expectedUnits: item.expectedUnits,
          finalUnits: item.finalUnits,
          tierUsed: item.listing.tierUsed,
          baseMinDaily: item.listing.baseMinDaily,
          baseMaxDaily: item.listing.baseMaxDaily,
          baseQty: item.listing.baseQty,
          positiveBoostPct: item.listing.positiveBoostPct,
          negativeBoostPct: item.listing.negativeBoostPct,
          priceIndex: item.listing.priceIndex,
          priceMultiplier: item.priceMultiplier,
          blockedByPrice: item.blockedByPrice,
          seasonScore: item.seasonScore,
          seasonMultiplier: item.seasonMultiplier,
          blockedBySeason: item.blockedBySeason,
          reasonsSnapshot,
          salePrice: item.listing.salePrice,
          listPrice: item.listing.listPrice,
        },
        update: {
          qtyOrdered: item.orderedQty,
          expectedUnits: item.expectedUnits,
          finalUnits: item.finalUnits,
          tierUsed: item.listing.tierUsed,
          baseMinDaily: item.listing.baseMinDaily,
          baseMaxDaily: item.listing.baseMaxDaily,
          baseQty: item.listing.baseQty,
          positiveBoostPct: item.listing.positiveBoostPct,
          negativeBoostPct: item.listing.negativeBoostPct,
          priceIndex: item.listing.priceIndex,
          priceMultiplier: item.priceMultiplier,
          blockedByPrice: item.blockedByPrice,
          seasonScore: item.seasonScore,
          seasonMultiplier: item.seasonMultiplier,
          blockedBySeason: item.blockedBySeason,
          reasonsSnapshot,
          salePrice: item.listing.salePrice,
          listPrice: item.listing.listPrice,
        },
      });

      // Out-of-stock: delete listing (do not pause)
      if (!item.inv || item.inv.qtyOnHand <= 0) {
        await tx.showcaseListing.deleteMany({ where: { id: item.listing.id } });
      }
    }

    // Only if no order exists yet: create ModaverseOrder + ModaverseOrderItem and decrement inventory
    if (!existingOrder) {
      const hasAnyOrder = stepAItems.some((i) => i.orderedQty > 0);
      if (hasAnyOrder) {
        const order = await tx.modaverseOrder.create({
          data: {
            companyId,
            warehouseBuildingId,
            dayKey: normalizedDayKey,
          },
        });
        let sortIndex = 1;
        for (const item of stepAItems) {
          if (item.orderedQty === 0) continue;
          if (!item.inv) continue; // already deleted listing

          await tx.modaverseOrderItem.create({
            data: {
              orderId: order.id,
              listingId: item.listing.id,
              productTemplateId: item.listing.productTemplateId,
              playerProductId: item.listing.playerProductId,
              qtyOrdered: item.orderedQty,
              qtyFulfilled: 0,
              qtyShipped: 0,
              sortIndex,
              salePriceUsd: item.listing.salePrice,
            },
          });

          const newQtyOnHand = item.inv.qtyOnHand - item.orderedQty;
          if (newQtyOnHand === 0) {
            await tx.showcaseListing.deleteMany({ where: { id: item.listing.id } });
          }
          sortIndex += 1;
        }
        orderCreated = true;
      }
    }

    // --- Step B: Fulfillment (capacity, FIFO, partial fills); create OUT movements and decrease qtyOnHand ---
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

    // warehouseMarketZone already set above for Step A log upserts
    const backlogItemsRaw = await tx.modaverseOrderItem.findMany({
      where: { order: { warehouseBuildingId, companyId } },
      include: { order: { select: { dayKey: true } } },
      orderBy: [{ order: { dayKey: 'asc' } }, { sortIndex: 'asc' }],
    });
    const backlogItems = backlogItemsRaw.filter((i) => i.qtyFulfilled < i.qtyOrdered);

    let remainingCapacity = capacity;
    let shippedToday = 0;
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
      shippedToday += ship;

      // Step B: upsert DailyProductSalesLog by listingKey_dayKey (do not load listing; it may be deleted)
      // Use order's dayKey so we update the log row for the day the order was placed
      const orderDayKey = item.order.dayKey;
      if (item.listingId) {
        await tx.dailyProductSalesLog.upsert({
          where: {
            listingKey_dayKey: {
              listingKey: item.listingId,
              dayKey: orderDayKey,
            },
          },
          create: {
            companyId,
            listingKey: item.listingId,
            listingId: item.listingId,
            marketZone: warehouseMarketZone,
            warehouseBuildingId,
            productTemplateId: item.productTemplateId,
            playerProductId: item.playerProductId ?? '',
            dayKey: orderDayKey,
            qtyOrdered: 0,
            qtyShipped: ship,
          },
          update: { qtyShipped: { increment: ship } },
        });
      }

      const newQtyOnHand = available - ship;
      if (newQtyOnHand === 0 && item.listingId) {
        await tx.showcaseListing.deleteMany({ where: { id: item.listingId } });
      }
    }

    // SALES_COUNT is daily only: set currentCount = today's shipped qty (do not accumulate)
    await tx.buildingMetricState.upsert({
      where: {
        buildingId_metricType: {
          buildingId: warehouseBuildingId,
          metricType: MetricType.SALES_COUNT,
        },
      },
      create: {
        buildingId: warehouseBuildingId,
        metricType: MetricType.SALES_COUNT,
        currentCount: shippedToday,
        currentLevel: 1,
        lastEvaluatedAt: new Date(),
      },
      update: {
        currentCount: shippedToday,
        lastEvaluatedAt: new Date(),
      },
    });

    // STOCK_COUNT: keep in sync with actual qtyOnHand after OUT movements (day tick complete)
    const stockAgg = await tx.buildingInventoryItem.aggregate({
      _sum: { qtyOnHand: true },
      where: {
        companyBuildingId: warehouseBuildingId,
        isArchived: false,
      },
    });
    const totalOnHand = stockAgg._sum.qtyOnHand ?? 0;
    await tx.buildingMetricState.upsert({
      where: {
        buildingId_metricType: {
          buildingId: warehouseBuildingId,
          metricType: MetricType.STOCK_COUNT,
        },
      },
      create: {
        buildingId: warehouseBuildingId,
        metricType: MetricType.STOCK_COUNT,
        currentCount: totalOnHand,
        currentLevel: 1,
        lastEvaluatedAt: new Date(),
      },
      update: {
        currentCount: totalOnHand,
        lastEvaluatedAt: new Date(),
      },
    });
    },
    { timeout: 60_000 }
  );

  return { orderCreated, itemsFulfilled };
}
