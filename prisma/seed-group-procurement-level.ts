/**
 * Run only the group procurement level seed (40 rows: 8 groups × 5 levels).
 * Usage: npx tsx prisma/seed-group-procurement-level.ts
 */

import { PrismaClient } from '@prisma/client';
import { seedGroupProcurementLevels } from './seeds/group_procurement_level.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding group procurement level metrics...');
  const count = await seedGroupProcurementLevels(prisma);
  console.log('Done. Total upserts:', count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
