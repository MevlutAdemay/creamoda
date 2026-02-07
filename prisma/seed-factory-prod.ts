/**
 * Run only the factory production seed (160 factories across EG, TN, CN, IN, BD).
 * Usage: npx tsx prisma/seed-factory-prod.ts
 */

import { PrismaClient } from '@prisma/client';
import { seedFactoriesProd } from './seeds/factory_prod.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding production factories (5 countries × 8 groups × 4 cities)...');
  const count = await seedFactoriesProd(prisma);
  console.log('Done. Total upserts:', count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
