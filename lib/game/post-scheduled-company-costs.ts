/**
 * Post scheduled company costs (payroll, rent, overhead) by day-of-month.
 * Uses FinanceScheduleConfig; idempotent via PAYROLL/RENT/OVERHEAD:companyId:YYYY-MM.
 */

import prisma from '@/lib/prisma';
import { normalizeUtcMidnight, getCycleKey } from '@/lib/game/game-clock';
import { postLedgerEntryAndUpdateWallet } from '@/lib/finance/helpers';
import {
  FinanceDirection,
  FinanceCategory,
  FinanceScopeType,
  FinanceCounterpartyType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const DEFAULT_PAYROLL_DAY = 1;
const DEFAULT_RENT_DAY = 15;
const DEFAULT_OVERHEAD_DAY = 15;

export interface PostScheduledCompanyCostsResult {
  payrollPosted: boolean;
  rentPosted: boolean;
  overheadPosted: boolean;
}

/**
 * Post payroll / rent / overhead for the given day if it matches schedule.
 * All filters and ledger dayKey use normalized day; idempotencyKey is YYYY-MM (getCycleKey).
 */
export async function postScheduledCompanyCosts(
  companyId: string,
  dayKey: Date
): Promise<PostScheduledCompanyCostsResult> {
  const day = normalizeUtcMidnight(dayKey);
  const cycleKey = getCycleKey(day); // YYYY-MM
  const result: PostScheduledCompanyCostsResult = {
    payrollPosted: false,
    rentPosted: false,
    overheadPosted: false,
  };

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { playerId: true },
    });
    if (!company?.playerId) return;

    const schedule = await tx.financeScheduleConfig.findUnique({
      where: { companyId },
      select: {
        payrollDayOfMonth: true,
        rentDayOfMonth: true,
        overheadDayOfMonth: true,
      },
    });
    const payrollDayOfMonth = schedule?.payrollDayOfMonth ?? DEFAULT_PAYROLL_DAY;
    const rentDayOfMonth = schedule?.rentDayOfMonth ?? DEFAULT_RENT_DAY;
    const overheadDayOfMonth = schedule?.overheadDayOfMonth ?? DEFAULT_OVERHEAD_DAY;
    const dom = day.getUTCDate();

    const basePayload = {
      companyId,
      dayKey: day,
      direction: FinanceDirection.OUT,
      scopeType: FinanceScopeType.COMPANY,
      scopeId: companyId,
      counterpartyType: FinanceCounterpartyType.SYSTEM,
      counterpartyId: null as string | null,
      refType: 'SCHEDULED_COST',
      refId: companyId,
    };

    // Payroll (day of month === payrollDayOfMonth)
    if (dom === payrollDayOfMonth) {
      const staff = await tx.companyStaff.findMany({
        where: {
          companyId,
          hiredAt: { lte: day },
          OR: [{ firedAt: null }, { firedAt: { gt: day } }],
        },
        select: { monthlySalaryFinal: true },
      });
      let payrollTotal = new Decimal(0);
      for (const s of staff) {
        payrollTotal = payrollTotal.add(s.monthlySalaryFinal);
      }
      if (payrollTotal.gt(0)) {
        await postLedgerEntryAndUpdateWallet(tx, company.playerId, {
          ...basePayload,
          amountUsd: payrollTotal,
          category: FinanceCategory.PAYROLL,
          idempotencyKey: `PAYROLL:${companyId}:${cycleKey}`,
          note: 'Monthly payroll',
        });
        result.payrollPosted = true;
      }
    }

    // Rent (day of month === rentDayOfMonth)
    if (dom === rentDayOfMonth) {
      const buildings = await tx.companyBuilding.findMany({
        where: { companyId },
        select: { id: true },
      });
      let rentTotal = new Decimal(0);
      for (const b of buildings) {
        const states = await tx.buildingMetricState.findMany({
          where: { buildingId: b.id },
          select: { rentPerMonthly: true },
          orderBy: { metricType: 'asc' },
        });
        const firstRent = states.find((s) => s.rentPerMonthly != null)?.rentPerMonthly;
        if (firstRent != null) rentTotal = rentTotal.add(firstRent);
      }
      if (rentTotal.gt(0)) {
        await postLedgerEntryAndUpdateWallet(tx, company.playerId, {
          ...basePayload,
          amountUsd: rentTotal,
          category: FinanceCategory.RENT,
          idempotencyKey: `RENT:${companyId}:${cycleKey}`,
          note: 'Monthly rent',
        });
        result.rentPosted = true;
      }
    }

    // Overhead (day of month === overheadDayOfMonth)
    if (dom === overheadDayOfMonth) {
      const buildings = await tx.companyBuilding.findMany({
        where: { companyId },
        select: { id: true },
      });
      let overheadTotal = new Decimal(0);
      for (const b of buildings) {
        const states = await tx.buildingMetricState.findMany({
          where: { buildingId: b.id },
          select: { overheadMonthly: true },
          orderBy: { metricType: 'asc' },
        });
        const firstOverhead = states.find((s) => s.overheadMonthly != null)?.overheadMonthly;
        if (firstOverhead != null) overheadTotal = overheadTotal.add(firstOverhead);
      }
      if (overheadTotal.gt(0)) {
        await postLedgerEntryAndUpdateWallet(tx, company.playerId, {
          ...basePayload,
          amountUsd: overheadTotal,
          category: FinanceCategory.OVERHEAD,
          idempotencyKey: `OVERHEAD:${companyId}:${cycleKey}`,
          note: 'Monthly overhead',
        });
        result.overheadPosted = true;
      }
    }
  });

  return result;
}
