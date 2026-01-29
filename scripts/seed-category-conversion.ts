/**
 * Seed CategoryConversionConfig based on manufacturing groups
 * 
 * Assigns baseConversionRate buckets by category characteristics:
 * - High impulse categories (accessories) → higher conversion
 * - High consideration categories (outerwear) → lower conversion
 * 
 * Run: npx tsx scripts/seed-category-conversion.ts
 */

import { PrismaClient, ManufacturingGroup } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Conversion rate mapping by manufacturing group
 * These values represent typical e-commerce conversion rates for each category type
 * 
 * Baseline: 0.08 (8%) - our reference point
 */
const CONVERSION_RATE_BY_GROUP: Record<ManufacturingGroup, number> = {
  // High impulse, low consideration
  ACCESSORY: 0.16, // 16% - bags, belts, hats (2x baseline)
  
  // Medium-high conversion
  FOOTWEAR: 0.12, // 12% - shoes, boots (1.5x baseline)
  
  // Medium conversion
  JERSEY: 0.10, // 10% - t-shirts, basic tops (1.25x baseline)
  
  // Baseline reference
  DENIM: 0.08, // 8% - jeans, denim jackets (1x baseline)
  
  // Medium-low conversion
  WOVEN: 0.06, // 6% - shirts, blouses (0.75x baseline)
  
  // Low conversion, higher consideration
  KNITWEAR: 0.05, // 5% - sweaters, cardigans (0.625x baseline)
  OUTERWEAR: 0.04, // 4% - coats, jackets (0.5x baseline, high ticket)
};

/**
 * Average decision days by manufacturing group
 * How many days customers typically take to decide on purchase
 */
const AVG_DECISION_DAYS_BY_GROUP: Record<ManufacturingGroup, number> = {
  ACCESSORY: 1, // Quick impulse purchases
  JERSEY: 2,
  FOOTWEAR: 3,
  DENIM: 3,
  WOVEN: 4,
  KNITWEAR: 5,
  OUTERWEAR: 7, // High consideration, seasonal planning
};

/**
 * Impulse score by manufacturing group (0.0 - 1.0)
 * Higher = more likely to be impulse purchase
 */
const IMPULSE_SCORE_BY_GROUP: Record<ManufacturingGroup, number> = {
  ACCESSORY: 0.9,
  JERSEY: 0.7,
  FOOTWEAR: 0.6,
  DENIM: 0.5,
  WOVEN: 0.4,
  KNITWEAR: 0.3,
  OUTERWEAR: 0.2,
};

async function seedCategoryConversionConfigs() {
  console.log('\n[seed-category-conversion] Starting...\n');

  // 1. Fetch all L3 categories with their manufacturing groups
  const l3Categories = await prisma.productCategoryNode.findMany({
    where: {
      level: 'L3',
      manufacturingGroup: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      manufacturingGroup: true,
    },
  });

  console.log(`Found ${l3Categories.length} L3 categories with manufacturing groups\n`);

  if (l3Categories.length === 0) {
    console.log('⚠️  No L3 categories found. Please seed category tree first.');
    return;
  }

  // 2. Group categories by manufacturing group for summary
  const groupCounts = new Map<ManufacturingGroup, number>();
  l3Categories.forEach((cat) => {
    if (cat.manufacturingGroup) {
      groupCounts.set(
        cat.manufacturingGroup,
        (groupCounts.get(cat.manufacturingGroup) || 0) + 1
      );
    }
  });

  console.log('Categories by manufacturing group:');
  groupCounts.forEach((count, group) => {
    console.log(`  ${group.padEnd(12)} → ${count} categories`);
  });
  console.log();

  // 3. Upsert conversion configs for each L3 category
  let created = 0;
  let updated = 0;

  for (const category of l3Categories) {
    if (!category.manufacturingGroup) continue;

    const baseConversionRate = CONVERSION_RATE_BY_GROUP[category.manufacturingGroup];
    const avgDecisionDays = AVG_DECISION_DAYS_BY_GROUP[category.manufacturingGroup];
    const impulseScore = IMPULSE_SCORE_BY_GROUP[category.manufacturingGroup];

    const existing = await prisma.categoryConversionConfig.findUnique({
      where: { categoryL3Id: category.id },
    });

    await prisma.categoryConversionConfig.upsert({
      where: { categoryL3Id: category.id },
      update: {
        baseConversionRate,
        avgDecisionDays,
        impulseScore,
        isActive: true,
      },
      create: {
        categoryL3Id: category.id,
        baseConversionRate,
        avgDecisionDays,
        impulseScore,
        isActive: true,
      },
    });

    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  console.log('\n✓ Seed complete:');
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Total:   ${created + updated}\n`);

  // 4. Show summary by conversion rate buckets
  console.log('Conversion rate distribution:');
  const buckets = new Map<number, number>();
  
  for (const group of Object.keys(CONVERSION_RATE_BY_GROUP)) {
    const rate = CONVERSION_RATE_BY_GROUP[group as ManufacturingGroup];
    const count = groupCounts.get(group as ManufacturingGroup) || 0;
    buckets.set(rate, (buckets.get(rate) || 0) + count);
  }

  // Sort by rate descending
  const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => b[0] - a[0]);
  
  for (const [rate, count] of sortedBuckets) {
    const mult = rate / 0.08;
    const pct = (rate * 100).toFixed(0);
    console.log(`  ${pct}% (${mult.toFixed(2)}x baseline) → ${count} categories`);
  }

  console.log();
}

async function main() {
  try {
    await seedCategoryConversionConfigs();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
