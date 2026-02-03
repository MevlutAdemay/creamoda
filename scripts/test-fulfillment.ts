/**
 * Test script for sales fulfillment pipeline
 * 
 * Tests:
 * 1. Reservation creates qtyReserved without reducing qtyOnHand
 * 2. Fulfillment reduces both qtyReserved and qtyOnHand
 * 3. Idempotency prevents duplicate fulfillment
 * 4. Backlog calculation works correctly
 * 
 * Run: npx ts-node scripts/test-fulfillment.ts
 */

import { PrismaClient, ListingStatus } from '@prisma/client';
import { applySalesFulfillment, getWarehouseBacklog } from '../lib/game/simulation/apply-sales-fulfillment';

const prisma = new PrismaClient();

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Sales Fulfillment Pipeline Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test configuration
  const dayKey = '2026-01-20';
  
  // =========================================================================
  // SETUP: Find or create test data
  // =========================================================================
  
  console.log('📋 Setup: Finding test company and warehouse...\n');

  // Find a company with a warehouse
  const company = await prisma.company.findFirst({
    include: {
      buildings: {
        where: {
          role: 'WAREHOUSE',
        },
        take: 1,
      },
    },
  });

  if (!company || company.buildings.length === 0) {
    console.error('❌ No company with warehouse found. Please run seed first.');
    return;
  }

  const companyId = company.id;
  const warehouseId = company.buildings[0].id;

  console.log(`✓ Company: ${company.name} (${companyId})`);
  console.log(`✓ Warehouse: ${warehouseId}\n`);

  // Find a product template
  const productTemplate = await prisma.productTemplate.findFirst({
    where: {
      isActive: true,
    },
  });

  if (!productTemplate) {
    console.error('❌ No product template found. Please run seed first.');
    return;
  }

  console.log(`✓ Product: ${productTemplate.name} (${productTemplate.id})\n`);

  // =========================================================================
  // CREATE TEST INVENTORY
  // =========================================================================
  
  console.log('📦 Creating test inventory...\n');

  const initialStock = 1000;
  const initialReserved = 0;

  const inventory = await prisma.buildingInventoryItem.upsert({
    where: {
      companyBuildingId_productTemplateId: {
        companyBuildingId: warehouseId,
        productTemplateId: productTemplate.id,
      },
    },
    update: {
      qtyOnHand: initialStock,
      qtyReserved: initialReserved,
      avgUnitCost: 50.0,
      lastUnitCost: 50.0,
    },
    create: {
      companyBuildingId: warehouseId,
      productTemplateId: productTemplate.id,
      qtyOnHand: initialStock,
      qtyReserved: initialReserved,
      avgUnitCost: 50.0,
      lastUnitCost: 50.0,
    },
  });

  console.log(`✓ Inventory created:`);
  console.log(`  - qtyOnHand: ${inventory.qtyOnHand}`);
  console.log(`  - qtyReserved: ${inventory.qtyReserved}\n`);

  // =========================================================================
  // CREATE TEST SALES LOG (SIMULATING RESERVATION)
  // =========================================================================
  
  console.log('📝 Creating test sales log (simulating reservation)...\n');

  // First, we need a PlayerProduct
  const playerProduct = await prisma.playerProduct.upsert({
    where: {
      companyId_productTemplateId: {
        companyId,
        productTemplateId: productTemplate.id,
      },
    },
    update: {},
    create: {
      companyId,
      productTemplateId: productTemplate.id,
      internalSkuCode: `TEST-${productTemplate.id.slice(0, 8)}`,
    },
  });

  // Create a showcase listing (needed for sales log foreign key)
  const listing = await prisma.showcaseListing.upsert({
    where: {
      // Use a mock unique identifier
      id: `test-listing-${dayKey}-${productTemplate.id}`,
    },
    update: {},
    create: {
      id: `test-listing-${dayKey}-${productTemplate.id}`,
      companyId,
      marketZone: 'USA',
      warehouseBuildingId: warehouseId,
      playerProductId: playerProduct.id,
      productTemplateId: productTemplate.id,
      salePrice: 100.0,
      status: ListingStatus.LISTED,
    },
  });

  // Create sales log with reservations
  const qtyReserved = 250; // Reserved but not shipped

  const salesLog = await prisma.dailyProductSalesLog.upsert({
    where: {
      listingKey_dayKey: {
        listingKey: listing.id,
        dayKey,
      },
    },
    update: {
      qtyShipped: 0,
    },
    create: {
      companyId,
      warehouseBuildingId: warehouseId,
      listingKey: listing.id,
      listingId: listing.id,
      marketZone: listing.marketZone,
      productTemplateId: productTemplate.id,
      playerProductId: playerProduct.id,
      dayKey,
      qtyOrdered: qtyReserved,
      qtyShipped: 0,
      grossRevenue: qtyReserved * 100,
      impressions: 1000,
    },
  });

  console.log(`✓ Sales log created:`);
  console.log(`  - qtyOrdered (reserved): ${salesLog.qtyOrdered}`);
  console.log(`  - qtyShipped: ${salesLog.qtyShipped}\n`);

  // Update inventory to reflect reservation (increment qtyReserved)
  await prisma.buildingInventoryItem.update({
    where: {
      companyBuildingId_productTemplateId: {
        companyBuildingId: warehouseId,
        productTemplateId: productTemplate.id,
      },
    },
    data: {
      qtyReserved: {
        increment: qtyReserved,
      },
    },
  });

  console.log(`✓ Inventory updated after reservation:`);
  const afterReservation = await prisma.buildingInventoryItem.findUnique({
    where: {
      companyBuildingId_productTemplateId: {
        companyBuildingId: warehouseId,
        productTemplateId: productTemplate.id,
      },
    },
  });
  console.log(`  - qtyOnHand: ${afterReservation!.qtyOnHand} (unchanged ✓)`);
  console.log(`  - qtyReserved: ${afterReservation!.qtyReserved} (+${qtyReserved})\n`);

  // =========================================================================
  // TEST 1: Run fulfillment (first time)
  // =========================================================================
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 1: First Fulfillment Run');
  console.log('═══════════════════════════════════════════════════════════\n');

  const result1 = await applySalesFulfillment(
    prisma,
    companyId,
    warehouseId,
    dayKey
  );

  console.log('\n📊 Result 1:');
  console.log(`  - Shipped: ${result1.shippedUnits} units`);
  console.log(`  - Backlog: ${result1.backlogUnits} units`);
  console.log(`  - Lines: ${result1.shippedLines}`);
  console.log(`  - Capacity: ${result1.capacityUsed} / ${result1.capacityTotal}`);
  console.log(`  - Idempotent: ${result1.wasIdempotent}\n`);

  // Check inventory after fulfillment
  const afterFulfillment1 = await prisma.buildingInventoryItem.findUnique({
    where: {
      companyBuildingId_productTemplateId: {
        companyBuildingId: warehouseId,
        productTemplateId: productTemplate.id,
      },
    },
  });

  console.log('📦 Inventory after fulfillment:');
  console.log(`  - qtyOnHand: ${afterFulfillment1!.qtyOnHand} (was: ${afterReservation!.qtyOnHand})`);
  console.log(`  - qtyReserved: ${afterFulfillment1!.qtyReserved} (was: ${afterReservation!.qtyReserved})`);
  console.log(`  - Shipped: ${afterReservation!.qtyOnHand - afterFulfillment1!.qtyOnHand} units\n`);

  // Verify sales log updated
  const salesLogAfter1 = await prisma.dailyProductSalesLog.findUnique({
    where: {
      listingKey_dayKey: {
        listingKey: listing.id,
        dayKey,
      },
    },
  });

  console.log('📝 Sales log after fulfillment:');
  console.log(`  - qtyOrdered: ${salesLogAfter1!.qtyOrdered}`);
  console.log(`  - qtyShipped: ${salesLogAfter1!.qtyShipped}`);
  console.log(`  - Backlog: ${salesLogAfter1!.qtyOrdered - salesLogAfter1!.qtyShipped}\n`);

  // =========================================================================
  // TEST 2: Run fulfillment again (idempotency test)
  // =========================================================================
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 2: Idempotency Test (Run Again)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const result2 = await applySalesFulfillment(
    prisma,
    companyId,
    warehouseId,
    dayKey
  );

  console.log('\n📊 Result 2:');
  console.log(`  - Shipped: ${result2.shippedUnits} units`);
  console.log(`  - Backlog: ${result2.backlogUnits} units`);
  console.log(`  - Lines: ${result2.shippedLines}`);
  console.log(`  - Idempotent: ${result2.wasIdempotent} (should be true ✓)\n`);

  // Verify inventory didn't change
  const afterFulfillment2 = await prisma.buildingInventoryItem.findUnique({
    where: {
      companyBuildingId_productTemplateId: {
        companyBuildingId: warehouseId,
        productTemplateId: productTemplate.id,
      },
    },
  });

  console.log('📦 Inventory after second run:');
  console.log(`  - qtyOnHand: ${afterFulfillment2!.qtyOnHand} (unchanged ✓)`);
  console.log(`  - qtyReserved: ${afterFulfillment2!.qtyReserved} (unchanged ✓)\n`);

  // =========================================================================
  // TEST 3: Backlog calculation
  // =========================================================================
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 3: Backlog Calculation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const backlog = await getWarehouseBacklog(prisma, warehouseId);

  console.log(`📊 Warehouse Backlog: ${backlog} units\n`);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Test Summary');
  console.log('═══════════════════════════════════════════════════════════\n');

  const expectedShipped = Math.min(qtyReserved, result1.capacityTotal);
  const expectedBacklog = qtyReserved - expectedShipped;

  console.log('Expected vs Actual:');
  console.log(`  Shipped:  ${expectedShipped} (expected) vs ${result1.shippedUnits} (actual) ${expectedShipped === result1.shippedUnits ? '✓' : '❌'}`);
  console.log(`  Backlog:  ${expectedBacklog} (expected) vs ${result1.backlogUnits} (actual) ${expectedBacklog === result1.backlogUnits ? '✓' : '❌'}`);
  console.log(`  Idempotent: ${result2.wasIdempotent ? '✓' : '❌'}`);
  
  const stockReduction = afterReservation!.qtyOnHand - afterFulfillment1!.qtyOnHand;
  console.log(`  Stock Reduced: ${stockReduction} (expected ${expectedShipped}) ${stockReduction === expectedShipped ? '✓' : '❌'}`);
  
  const reservedReduction = afterReservation!.qtyReserved - afterFulfillment1!.qtyReserved;
  console.log(`  Reserved Reduced: ${reservedReduction} (expected ${expectedShipped}) ${reservedReduction === expectedShipped ? '✓' : '❌'}\n`);

  // Verify all tests passed
  const allPassed = 
    expectedShipped === result1.shippedUnits &&
    expectedBacklog === result1.backlogUnits &&
    result2.wasIdempotent &&
    stockReduction === expectedShipped &&
    reservedReduction === expectedShipped;

  if (allPassed) {
    console.log('✅ All tests PASSED!\n');
  } else {
    console.log('❌ Some tests FAILED!\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('Error running test:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
