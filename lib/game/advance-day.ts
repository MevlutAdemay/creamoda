// lib/game/advance-day.ts
/**
 * Advance company game day by one day (UTC midnight).
 * Runs warehouse day tick for each warehouse, then settlement payout on 5th/20th.
 * Single entry point for day advance; no redundant endpoints.
 */

import prisma from '@/lib/prisma';
import { getCompanyGameClock, normalizeUtcMidnight, isPayoutDayForCompany } from '@/lib/game/game-clock';
import { runWarehouseDayTick } from '@/lib/game/run-warehouse-day-tick';
import { buildAndPostSettlement } from '@/lib/game/build-and-post-settlement';
import { postScheduledCompanyCosts } from '@/lib/game/post-scheduled-company-costs';
import { createScheduledCostsFinanceMessageIfNeeded } from '@/lib/game/finance-inbox-messages';
import { createBacklogWarningMessageIfNeeded } from '@/lib/game/logistics-inbox-messages';
import { applyCampaignEndAwareness } from '@/lib/game/apply-campaign-end-awareness';
import { BuildingRole } from '@prisma/client';

export interface AdvanceCompanyDayResult {
  previousDayKey: Date;
  newDayKey: Date;
  warehousesTicked: number;
  settlementsRun: number;
}

/**
 * Advance the company's game day by one day (UTC midnight).
 * 1. Increments currentDayKey by 1 day.
 * 2. For each warehouse, runs runWarehouseDayTick(companyId, warehouseBuildingId, newDayKey).
 * 3. If newDayKey is 5th or 20th, runs buildAndPostSettlement for each warehouse.
 */
/** Thrown when clock update affects 0 rows (concurrent advance). */
export const ADVANCE_DAY_CONCURRENT = 'ADVANCE_DAY_CONCURRENT';

export async function advanceCompanyDay(companyId: string): Promise<AdvanceCompanyDayResult> {
  const clock = await getCompanyGameClock(companyId);
  const previousDayKey = clock.currentDayKey;
  const nextDay = new Date(previousDayKey);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const newDayKey = normalizeUtcMidnight(nextDay);

  const warehouses = await prisma.companyBuilding.findMany({
    where: { companyId, role: BuildingRole.WAREHOUSE },
    select: { id: true },
  });

  const updated = await prisma.companyGameClock.updateMany({
    where: { companyId, version: clock.version },
    data: {
      currentDayKey: newDayKey,
      version: clock.version + 1,
      lastAdvancedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    throw new Error(ADVANCE_DAY_CONCURRENT);
  }

  let warehousesTicked = 0;
  for (const wh of warehouses) {
    await runWarehouseDayTick(companyId, wh.id, newDayKey);
    warehousesTicked += 1;
    await createBacklogWarningMessageIfNeeded(companyId, wh.id, newDayKey);
  }

  await applyCampaignEndAwareness(companyId, newDayKey);

  const costResult = await postScheduledCompanyCosts(companyId, newDayKey);

  let settlementsRun = 0;
  if (await isPayoutDayForCompany(companyId, newDayKey)) {
    for (const wh of warehouses) {
      const res = await buildAndPostSettlement(companyId, wh.id, newDayKey);
      if (res) settlementsRun += 1;
    }
  }

  const anyCostPosted =
    costResult.payrollPosted || costResult.rentPosted || costResult.overheadPosted;
  if (anyCostPosted) {
    await createScheduledCostsFinanceMessageIfNeeded(companyId, newDayKey, costResult);
  }

  return {
    previousDayKey,
    newDayKey,
    warehousesTicked,
    settlementsRun,
  };
}
