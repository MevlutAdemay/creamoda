/**
 * One-time data fix: set marketZone from warehouse (CompanyBuilding.marketZone) for
 * ShowcaseListing and DailyProductSalesLog. Use after correcting UI/API so marketZone
 * is no longer user-selected.
 *
 * Run: npx tsx scripts/fix-marketzone-from-warehouse.ts
 */

import { PrismaClient, BuildingRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Fix marketZone from warehouse (ShowcaseListing, DailyProductSalesLog)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const warehouses = await prisma.companyBuilding.findMany({
    where: { role: BuildingRole.WAREHOUSE },
    select: { id: true, marketZone: true },
  });

  const withZone = warehouses.filter((w) => w.marketZone != null);
  if (withZone.length === 0) {
    console.log('No warehouses with marketZone set. Nothing to fix.');
    return;
  }

  let totalListings = 0;
  let totalLogs = 0;

  for (const wh of withZone) {
    const marketZone = wh.marketZone!;

    const r1 = await prisma.showcaseListing.updateMany({
      where: { warehouseBuildingId: wh.id },
      data: { marketZone },
    });
    totalListings += r1.count;

    const r2 = await prisma.dailyProductSalesLog.updateMany({
      where: { warehouseBuildingId: wh.id },
      data: { marketZone },
    });
    totalLogs += r2.count;

    if (r1.count > 0 || r2.count > 0) {
      console.log(`Warehouse ${wh.id} (${marketZone}): ShowcaseListing ${r1.count}, DailyProductSalesLog ${r2.count}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`ShowcaseListing rows updated: ${totalListings}`);
  console.log(`DailyProductSalesLog rows updated: ${totalLogs}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
