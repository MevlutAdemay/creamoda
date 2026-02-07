/**
 * Run only the factory names fix seed.
 * Usage: npx tsx prisma/seed-factory-names-fix.ts
 */

import { PrismaClient } from '@prisma/client';
import { fixFactoryNames } from './seeds/factory_names_fix.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing factory names (deterministic from code + country + city)...');
  const count = await fixFactoryNames(prisma);
  console.log('Done. Updated:', count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
