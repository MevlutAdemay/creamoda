/**
 * Seed MarketZonePriceIndex + RarityConfig.
 * Idempotent — upsert by marketZone / rarity.
 *
 * Run: npx tsx scripts/seed-market-zone-and-rarity.ts
 * Or:  npm run seed:market-zone-and-rarity
 */

import { PrismaClient, MarketZone, ProductRarity } from '@prisma/client';

const prisma = new PrismaClient();

const MARKET_ZONE_MULTIPLIERS: { marketZone: MarketZone; multiplier: number }[] = [
  { marketZone: 'AFRICA_SOUTH', multiplier: 0.9 },
  { marketZone: 'APAC_EAST', multiplier: 1.08 },
  { marketZone: 'APAC_SOUTH', multiplier: 0.95 },
  { marketZone: 'CANADA', multiplier: 1.1 },
  { marketZone: 'EU_NORTH', multiplier: 1.15 },
  { marketZone: 'EU_SOUTH', multiplier: 1.05 },
  { marketZone: 'EU_CENTRAL', multiplier: 1.12 },
  { marketZone: 'BALKANS', multiplier: 0.96 },
  { marketZone: 'LATAM_NORTH', multiplier: 0.94 },
  { marketZone: 'LATAM_SOUTH', multiplier: 0.92 },
  { marketZone: 'MENA', multiplier: 1.0 },
  { marketZone: 'OCEANIA', multiplier: 1.13 },
  { marketZone: 'TURKIYE', multiplier: 1.0 },
  { marketZone: 'USA', multiplier: 1.12 },
];

const RARITY_DEMAND_MULTIPLIERS: { rarity: ProductRarity; demandMultiplier: number }[] = [
  { rarity: 'STANDARD', demandMultiplier: 1.0 },
  { rarity: 'GOLD', demandMultiplier: 1.4 },
  { rarity: 'PLATINUM', demandMultiplier: 2.2 },
  { rarity: 'DIAMOND', demandMultiplier: 3.2 },
];

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Seed MarketZonePriceIndex + RarityConfig');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const row of MARKET_ZONE_MULTIPLIERS) {
    await prisma.marketZonePriceIndex.upsert({
      where: { marketZone: row.marketZone },
      create: {
        marketZone: row.marketZone,
        multiplier: row.multiplier,
        isActive: true,
      },
      update: {
        multiplier: row.multiplier,
        isActive: true,
      },
    });
    console.log('MarketZonePriceIndex:', row.marketZone, '=', row.multiplier);
  }

  for (const row of RARITY_DEMAND_MULTIPLIERS) {
    await prisma.rarityConfig.upsert({
      where: { rarity: row.rarity },
      create: {
        rarity: row.rarity,
        demandMultiplier: row.demandMultiplier,
        isActive: true,
      },
      update: {
        demandMultiplier: row.demandMultiplier,
        isActive: true,
      },
    });
    console.log('RarityConfig:', row.rarity, '=', row.demandMultiplier);
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
