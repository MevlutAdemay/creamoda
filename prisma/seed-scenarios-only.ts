/**
 * Sadece MarketZoneSeasonScenario seed'ini çalıştırır (tüm seed uzun sürmeden).
 * Kullanım: npm run db:seed:scenarios
 */
import { PrismaClient } from '@prisma/client';
import { seedMarketZoneSeasonScenarios } from './seed/market-zone-season-scenarios.seed';

const prisma = new PrismaClient();

async function main() {
  await seedMarketZoneSeasonScenarios(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
