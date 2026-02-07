/**
 * Run only the production countries seed (Egypt, Tunisia, China, India, Bangladesh).
 * Usage: npx tsx prisma/seed-country-prod.ts
 */

import { PrismaClient } from '@prisma/client';
import { seedProductionCountries } from './seed/country_prod.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding production countries (EG, TN, CN, IN, BD)...');
  await seedProductionCountries(prisma);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
