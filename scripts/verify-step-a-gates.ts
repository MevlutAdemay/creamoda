/**
 * Verify Step A gates: priceIndex > 1.15 => 0 qty (no order item/log); seasonScore === 0 => 0 qty.
 *
 * Run: npx tsx scripts/verify-step-a-gates.ts
 *
 * Requires: seeded company with warehouse (USA), product template, MarketZonePriceIndex for USA.
 */

import { PrismaClient } from '@prisma/client';
import { runWarehouseDayTick } from '../lib/game/run-warehouse-day-tick';
import { normalizeUtcMidnight } from '../lib/game/game-clock';
import { getWeekIndex0FromDayKey } from '../lib/game/season-score';

const prisma = new PrismaClient();

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Verify Step A gates (priceIndex > 1.15, seasonScore === 0)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const dayKey = normalizeUtcMidnight(new Date('2026-01-25T00:00:00.000Z'));

  const company = await prisma.company.findFirst({
    include: { buildings: { where: { role: 'WAREHOUSE' }, take: 1 } },
  });
  if (!company || company.buildings.length === 0) {
    console.error('No company with warehouse. Seed first.');
    process.exit(1);
  }
  const companyId = company.id;
  const warehouseId = company.buildings[0].id;

  const warehouse = await prisma.companyBuilding.findUnique({
    where: { id: warehouseId },
    select: { marketZone: true },
  });
  const marketZone = warehouse?.marketZone ?? 'USA';

  const template = await prisma.productTemplate.findFirst({
    where: { isActive: true },
    select: { id: true, suggestedSalePrice: true, seasonScenarioDefinitionId: true },
  });
  if (!template) {
    console.error('No product template. Seed first.');
    process.exit(1);
  }

  const priceRow = await prisma.marketZonePriceIndex.findUnique({
    where: { marketZone },
    select: { multiplier: true },
  });
  const multiplier = priceRow?.multiplier != null ? Number(priceRow.multiplier) : 1;
  const normalPrice = Number(template.suggestedSalePrice) * multiplier;
  const salePriceForBlock = normalPrice * 1.16;

  const playerProduct = await prisma.playerProduct.upsert({
    where: { companyId_productTemplateId: { companyId, productTemplateId: template.id } },
    update: {},
    create: {
      companyId,
      productTemplateId: template.id,
      internalSkuCode: `GATE-${template.id.slice(0, 8)}`,
    },
  });

  await prisma.buildingInventoryItem.upsert({
    where: {
      companyBuildingId_productTemplateId: { companyBuildingId: warehouseId, productTemplateId: template.id },
    },
    update: { qtyOnHand: 10 },
    create: {
      companyBuildingId: warehouseId,
      productTemplateId: template.id,
      playerProductId: playerProduct.id,
      qtyOnHand: 10,
      avgUnitCost: 10,
      lastUnitCost: 10,
    },
  });

  await prisma.modaverseOrder.deleteMany({ where: { warehouseBuildingId: warehouseId, dayKey } });

  let passed = 0;

  // --- Price gate: priceIndex 1.16 => priceMultiplier 0 => 0 qty, no order item/log ---
  console.log('Test: priceIndex 1.16 => expect 0 qty, no ModaverseOrderItem/DailyProductSalesLog for listing');
  const listingPrice = await prisma.showcaseListing.upsert({
    where: {
      companyId_marketZone_playerProductId: { companyId, marketZone, playerProductId: playerProduct.id },
    },
    update: {
      status: 'LISTED',
      warehouseBuildingId: warehouseId,
      salePrice: salePriceForBlock,
    },
    create: {
      companyId,
      marketZone,
      warehouseBuildingId: warehouseId,
      playerProductId: playerProduct.id,
      productTemplateId: template.id,
      status: 'LISTED',
      salePrice: salePriceForBlock,
    },
  });

  const resPrice = await runWarehouseDayTick(companyId, warehouseId, dayKey);
  const orderPrice = await prisma.modaverseOrder.findUnique({
    where: { warehouseBuildingId_dayKey: { warehouseBuildingId: warehouseId, dayKey } },
    include: { items: true },
  });
  const logPrice = await prisma.dailyProductSalesLog.findUnique({
    where: { listingKey_dayKey: { listingKey: listingPrice.id, dayKey } },
  });
  const noItemForListing = !orderPrice?.items.some((i) => i.listingId === listingPrice.id);
  const noLogForListing = !logPrice;
  const okPrice = noItemForListing && noLogForListing;
  if (okPrice) {
    console.log('  OK: no order item and no sales log for listing (price gate)\n');
    passed++;
  } else {
    console.log(`  FAIL: orderItems with listing=${orderPrice?.items.filter((i) => i.listingId === listingPrice.id).length ?? 0}, log exists=${!!logPrice}\n`);
  }

  // --- Season gate: seasonScore 0 => 0 qty ---
  console.log('Test: seasonScore 0 => expect 0 qty for that listing');
  const weekIndex0 = getWeekIndex0FromDayKey(dayKey);
  const zeros = Array(52).fill(0);
  const seasonDef = await prisma.seasonScenarioDefinition.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!seasonDef) {
    console.log('  SKIP: no SeasonScenarioDefinition (seed season data for full check)\n');
  } else {
    await prisma.marketZoneSeasonScenario.upsert({
      where: {
        definitionId_marketZone: { definitionId: seasonDef.id, marketZone },
      },
      update: { weeksJson: zeros, isActive: true },
      create: {
        definitionId: seasonDef.id,
        marketZone,
        weeksJson: zeros,
        isActive: true,
      },
    });
    await prisma.productTemplate.update({
      where: { id: template.id },
      data: { seasonScenarioDefinitionId: seasonDef.id },
    });
    await prisma.showcaseListing.update({
      where: { id: listingPrice.id },
      data: { salePrice: normalPrice * 0.95 },
    });
    await prisma.modaverseOrder.deleteMany({ where: { warehouseBuildingId: warehouseId, dayKey } });

    const resSeason = await runWarehouseDayTick(companyId, warehouseId, dayKey);
    const orderSeason = await prisma.modaverseOrder.findUnique({
      where: { warehouseBuildingId_dayKey: { warehouseBuildingId: warehouseId, dayKey } },
      include: { items: true },
    });
    const logSeason = await prisma.dailyProductSalesLog.findUnique({
      where: { listingKey_dayKey: { listingKey: listingPrice.id, dayKey } },
    });
    const noItemSeason = !orderSeason?.items.some((i) => i.listingId === listingPrice.id);
    const noLogSeason = !logSeason;
    const okSeason = noItemSeason && noLogSeason;
    if (okSeason) {
      console.log('  OK: no order item and no sales log for listing (season gate)\n');
      passed++;
    } else {
      console.log(`  FAIL: orderItems with listing=${orderSeason?.items.filter((i) => i.listingId === listingPrice.id).length ?? 0}, log exists=${!!logSeason}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Passed: ${passed} (price gate + optional season gate)\n`);
  if (passed < 1) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
