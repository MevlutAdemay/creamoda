/**
 * Advance company game day by one day (UTC midnight).
 * Runs warehouse day tick for each warehouse, then settlement payout on 5th/20th.
 * Single entry point for day advance; no redundant endpoints.
 */

import prisma from '@/lib/prisma';
import { getCompanyGameClock, normalizeUtcMidnight, isPayoutDay } from '@/lib/game/game-clock';
import { runWarehouseDayTick } from '@/lib/game/run-warehouse-day-tick';
import { buildAndPostSettlement } from '@/lib/game/build-and-post-settlement';
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

  await prisma.companyGameClock.update({
    where: { companyId },
    data: {
      currentDayKey: newDayKey,
      version: { increment: 1 },
      lastAdvancedAt: new Date(),
    },
  });

  let warehousesTicked = 0;
  for (const wh of warehouses) {
    await runWarehouseDayTick(companyId, wh.id, newDayKey);
    warehousesTicked += 1;
  }

  let settlementsRun = 0;
  if (isPayoutDay(newDayKey)) {
    for (const wh of warehouses) {
      const res = await buildAndPostSettlement(companyId, wh.id, newDayKey);
      if (res) settlementsRun += 1;
    }
  }

  return {
    previousDayKey,
    newDayKey,
    warehousesTicked,
    settlementsRun,
  };
}
