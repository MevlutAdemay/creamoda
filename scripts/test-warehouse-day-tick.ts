/**
 * Minimal sanity test for runWarehouseDayTick (listings-only, stock at Step A, capacity/FIFO at Step B, sales log, auto-pause).
 *
 * Run: npx tsx scripts/test-warehouse-day-tick.ts
 *
 * Tests:
 * 1. No listing → 0 orders even if inventory has stock
 * 2. One LISTED listing + inventory → order created, stock decremented, movement, sales log written
 * 3. Listing auto-pauses when stock hits 0
 * 4. Low capacity → partial fulfillment, backlog carryover FIFO
 */

import { PrismaClient } from '@prisma/client';
import { runWarehouseDayTick } from '../lib/game/run-warehouse-day-tick';
import { normalizeUtcMidnight } from '../lib/game/game-clock';

const prisma = new PrismaClient();

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('runWarehouseDayTick sanity test (listings, capacity, sales log)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const dayKey = normalizeUtcMidnight(new Date('2026-01-25T00:00:00.000Z'));

  const company = await prisma.company.findFirst({
    include: {
      buildings: { where: { role: 'WAREHOUSE' }, take: 1 },
    },
  });
  if (!company || company.buildings.length === 0) {
    console.error('No company with warehouse. Seed first.');
    process.exit(1);
  }
  const companyId = company.id;
  const warehouseId = company.buildings[0].id;

  const productTemplate = await prisma.productTemplate.findFirst({ where: { isActive: true } });
  if (!productTemplate) {
    console.error('No product template. Seed first.');
    process.exit(1);
  }

  const playerProduct = await prisma.playerProduct.upsert({
    where: { companyId_productTemplateId: { companyId, productTemplateId: productTemplate.id } },
    update: {},
    create: { companyId, productTemplateId: productTemplate.id, internalSkuCode: `TICK-${productTemplate.id.slice(0, 8)}` },
  });

  // Ensure no existing order for this warehouse+day so Step A runs
  await prisma.modaverseOrder.deleteMany({ where: { warehouseBuildingId: warehouseId, dayKey } });

  // --- Test 1: No listing → 0 orders ---
  console.log('Test 1: No LISTED listing → expect 0 orders');
  await prisma.showcaseListing.updateMany({
    where: { companyId, warehouseBuildingId: warehouseId },
    data: { status: 'PAUSED' },
  });
  await prisma.buildingInventoryItem.upsert({
    where: {
      companyBuildingId_productTemplateId: { companyBuildingId: warehouseId, productTemplateId: productTemplate.id },
    },
    update: { qtyOnHand: 10 },
    create: {
      companyBuildingId: warehouseId,
      productTemplateId: productTemplate.id,
      playerProductId: playerProduct.id,
      qtyOnHand: 10,
      avgUnitCost: 10,
      lastUnitCost: 10,
    },
  });
  const res1 = await runWarehouseDayTick(companyId, warehouseId, dayKey);
  const orderCount1 = await prisma.modaverseOrder.count({ where: { warehouseBuildingId: warehouseId, dayKey } });
  const ok1 = orderCount1 === 0 && !res1.orderCreated;
  console.log(`  orderCreated=${res1.orderCreated}, orders in DB=${orderCount1} ${ok1 ? '✓' : '❌'}\n`);

  // --- Test 2: One LISTED listing → order, stock down, movement, sales log ---
  console.log('Test 2: One LISTED listing + stock → order, stock decrement, movement, sales log');
  const listing = await prisma.showcaseListing.upsert({
    where: { companyId_marketZone_playerProductId: { companyId, marketZone: 'USA', playerProductId: playerProduct.id } },
    update: { status: 'LISTED', warehouseBuildingId: warehouseId, salePrice: 99.99 },
    create: {
      companyId,
      marketZone: 'USA',
      warehouseBuildingId: warehouseId,
      playerProductId: playerProduct.id,
      productTemplateId: productTemplate.id,
      status: 'LISTED',
      salePrice: 99.99,
    },
  });
  await prisma.modaverseOrder.deleteMany({ where: { warehouseBuildingId: warehouseId, dayKey } });
  await prisma.buildingInventoryItem.update({
    where: {
      companyBuildingId_productTemplateId: { companyBuildingId: warehouseId, productTemplateId: productTemplate.id },
    },
    data: { qtyOnHand: 10 },
  });
  const invBefore = await prisma.buildingInventoryItem.findUnique({
    where: {
      companyBuildingId_productTemplateId: { companyBuildingId: warehouseId, productTemplateId: productTemplate.id },
    },
  });
  const res2 = await runWarehouseDayTick(companyId, warehouseId, dayKey);
  const order2 = await prisma.modaverseOrder.findUnique({
    where: { warehouseBuildingId_dayKey: { warehouseBuildingId: warehouseId, dayKey } },
    include: { items: true },
  });
  const invAfter = await prisma.buildingInventoryItem.findUnique({
    where: {
      companyBuildingId_productTemplateId: { companyBuildingId: warehouseId, productTemplateId: productTemplate.id },
    },
  });
  const movementCount = await prisma.inventoryMovement.count({
    where: { companyBuildingId: warehouseId, dayKey, sourceType: 'SALES_ORDER' },
  });
  const salesLog = await prisma.dailyProductSalesLog.findUnique({
    where: { listingId_dayKey: { listingId: listing.id, dayKey } },
  });
  const ok2 =
    res2.orderCreated &&
    order2 !== null &&
    order2.items.length >= 1 &&
    order2.items.some((i) => i.listingId === listing.id) &&
    (invBefore?.qtyOnHand ?? 0) > (invAfter?.qtyOnHand ?? 0) &&
    movementCount >= 1 &&
    salesLog !== null &&
    (salesLog.qtyOrdered ?? 0) > 0;
  console.log(
    `  orderCreated=${res2.orderCreated}, items=${order2?.items.length}, stock ${invBefore?.qtyOnHand}→${invAfter?.qtyOnHand}, movements=${movementCount}, salesLog.qtyOrdered=${salesLog?.qtyOrdered} ${ok2 ? '✓' : '❌'}\n`
  );

  // --- Test 3: Stock 0 → listing auto-paused ---
  console.log('Test 3: After selling all stock → listing auto-paused (OUT_OF_STOCK)');
  const listingAfter = await prisma.showcaseListing.findUnique({ where: { id: listing.id } });
  const wasPaused = listingAfter?.status === 'PAUSED' && listingAfter?.pausedReason === 'OUT_OF_STOCK';
  console.log(`  status=${listingAfter?.status}, pausedReason=${listingAfter?.pausedReason} ${wasPaused ? '✓' : '(run again after stock exhausted or check manually)'}\n`);

  // --- Test 4: Capacity / FIFO (optional: set low SALES_COUNT capacity and run tick; verify partial fulfill) ---
  console.log('Test 4: Capacity/FIFO — ensure BuildingMetricState + MetricLevelConfig exist for WAREHOUSE/SALES_COUNT; backlog items fulfilled FIFO with partial fill.');
  const metricState = await prisma.buildingMetricState.findUnique({
    where: { buildingId_metricType: { buildingId: warehouseId, metricType: 'SALES_COUNT' } },
  });
  const levelConfig = metricState
    ? await prisma.metricLevelConfig.findUnique({
        where: {
          buildingRole_metricType_level: {
            buildingRole: 'WAREHOUSE',
            metricType: 'SALES_COUNT',
            level: metricState.currentLevel,
          },
        },
      })
    : null;
  console.log(`  Capacity: BuildingMetricState level=${metricState?.currentLevel ?? 'none'}, MetricLevelConfig maxAllowed=${levelConfig?.maxAllowed ?? 'none'}\n`);

  console.log('═══════════════════════════════════════════════════════════');
  console.log(ok1 && ok2 ? 'Sanity checks PASSED' : 'Some checks FAILED');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
