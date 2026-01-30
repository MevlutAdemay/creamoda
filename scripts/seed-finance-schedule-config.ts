/**
 * Standalone seed: ensure every Company has a FinanceScheduleConfig row with default values.
 * Idempotent — safe to run multiple times.
 *
 * Run: npx tsx scripts/seed-finance-schedule-config.ts
 * Or:  npm run seed:finance-schedule
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULTS = {
  payrollDayOfMonth: 1,
  rentDayOfMonth: 15,
  overheadDayOfMonth: 15,
  payoutDayOfMonth1: 5,
  payoutDayOfMonth2: 20,
};

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Seed FinanceScheduleConfig (defaults per company)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const companies = await prisma.company.findMany({
    select: { id: true },
  });
  const scanned = companies.length;
  let created = 0;
  let updated = 0;

  for (const company of companies) {
    const existing = await prisma.financeScheduleConfig.findUnique({
      where: { companyId: company.id },
    });
    if (existing) {
      await prisma.financeScheduleConfig.update({
        where: { companyId: company.id },
        data: DEFAULTS,
      });
      updated += 1;
    } else {
      await prisma.financeScheduleConfig.create({
        data: {
          companyId: company.id,
          ...DEFAULTS,
        },
      });
      created += 1;
    }
  }

  console.log('Companies scanned:', scanned);
  console.log('FinanceScheduleConfig created:', created);
  console.log('FinanceScheduleConfig updated:', updated);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
