/**
 * Backfill Script: Update CompanyStaff.hiredAt to use game dayKey
 * 
 * This script updates existing CompanyStaff records where hiredAt was set by system time
 * to use the company's game clock startedAtDayKey (or currentDayKey as fallback).
 * 
 * Usage (dev only):
 *   npx tsx scripts/backfill-staff-hired-at.ts
 * 
 * Or with ts-node:
 *   ts-node scripts/backfill-staff-hired-at.ts
 */

import prisma from '../lib/prisma';
import { DEFAULT_GAME_START_DATE, normalizeUtcMidnight } from '../lib/game/game-clock';

async function backfillStaffHiredAt() {
  console.log('Starting backfill of CompanyStaff.hiredAt...');

  try {
    // Get all staff records
    const allStaff = await prisma.companyStaff.findMany({
      select: {
        id: true,
        companyId: true,
        hiredAt: true,
      },
    });

    console.log(`Found ${allStaff.length} staff records to process`);

    let updated = 0;
    let skipped = 0;

    for (const staff of allStaff) {
      // Get company's game clock
      const gameClock = await prisma.companyGameClock.findUnique({
        where: { companyId: staff.companyId },
        select: {
          startedAtDayKey: true,
          currentDayKey: true,
        },
      });

      // Determine the dayKey to use
      const dayKey = gameClock
        ? normalizeUtcMidnight(gameClock.startedAtDayKey || gameClock.currentDayKey)
        : normalizeUtcMidnight(DEFAULT_GAME_START_DATE);

      // Only update if hiredAt differs from the target dayKey
      const currentHiredAt = normalizeUtcMidnight(staff.hiredAt);
      if (currentHiredAt.getTime() === dayKey.getTime()) {
        skipped++;
        continue;
      }

      // Update the staff record
      await prisma.companyStaff.update({
        where: { id: staff.id },
        data: { hiredAt: dayKey },
      });

      updated++;
    }

    console.log(`\nBackfill complete:`);
    console.log(`  - Updated: ${updated} records`);
    console.log(`  - Skipped: ${skipped} records (already correct)`);
    console.log(`  - Total: ${allStaff.length} records`);
  } catch (error) {
    console.error('Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  backfillStaffHiredAt()
    .then(() => {
      console.log('Backfill script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Backfill script failed:', error);
      process.exit(1);
    });
}

export default backfillStaffHiredAt;
