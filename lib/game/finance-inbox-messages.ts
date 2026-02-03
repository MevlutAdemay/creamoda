/**
 * Finance inbox message helpers. Run only outside Prisma transactions using plain prisma.
 * Idempotent via dedupeKey; use findUnique + create with P2002 catch for race safety.
 */

import prisma from '@/lib/prisma';
import { normalizeUtcMidnight, getCycleKey } from '@/lib/game/game-clock';
import { FinanceDirection, FinanceCategory } from '@prisma/client';
import { MessageCategory, MessageLevel, MessageKind, DepartmentCode } from '@prisma/client';
import { BuildingRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { PostScheduledCompanyCostsResult } from '@/lib/game/post-scheduled-company-costs';

/** Format dayKey for message body: "Feb 1, 2026" (UTC). */
function formatCostDate(day: Date): string {
  const d = day.getUTCDate();
  const m = day.getUTCMonth();
  const y = day.getUTCFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m]} ${d}, ${y}`;
}

/** Format amount as $X,XXX.XX */
function formatUsd(amount: Decimal): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** Building display label: "Headquarters" or "Warehouse TURKIYE" (role + marketZone only; strips "Warehouse - " prefix from zone). */
function buildingLabel(b: { role: BuildingRole; marketZone: string | null }): string {
  if (b.role === BuildingRole.HQ) return 'Headquarters';
  if (b.role === BuildingRole.WAREHOUSE) {
    const zone = (b.marketZone ?? '').replace(/^Warehouse\s*[-–]\s*/i, '').trim() || '—';
    return `Warehouse ${zone}`;
  }
  return '—';
}

/**
 * Create at most one Finance (INFO) message per company per dayKey when scheduled costs were posted.
 * Body shows building-level breakdown (HQ + warehouses) for payroll, rent, overhead from source tables.
 * Only runs when at least one cost type was posted. Sections included per costResult (payrollPosted, etc.).
 * Idempotency: FINANCE_COSTS_MESSAGE:{companyId}:{cycleKey}:{dayOfMonth}.
 * Uses plain prisma (no tx). On duplicate (P2002) we no-op.
 */
export async function createScheduledCostsFinanceMessageIfNeeded(
  companyId: string,
  dayKey: Date,
  costResult: PostScheduledCompanyCostsResult
): Promise<void> {
  const anyCostPosted =
    costResult.payrollPosted || costResult.rentPosted || costResult.overheadPosted;
  if (!anyCostPosted) return;

  const day = normalizeUtcMidnight(dayKey);
  const cycleKey = getCycleKey(day);
  const dayOfMonth = day.getUTCDate();
  const dedupeKey = `FINANCE_COSTS_MESSAGE:${companyId}:${cycleKey}:${dayOfMonth}`;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { playerId: true },
  });
  if (!company?.playerId) return;

  const existing = await prisma.playerMessage.findUnique({
    where: { playerId_dedupeKey: { playerId: company.playerId, dedupeKey } },
  });
  if (existing) return;

  const buildings = await prisma.companyBuilding.findMany({
    where: { companyId },
    select: { id: true, role: true, marketZone: true },
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
  });

  const dateStr = formatCostDate(day);
  const bodyParts: string[] = [];

  if (costResult.payrollPosted) {
    const staff = await prisma.companyStaff.findMany({
      where: {
        companyId,
        hiredAt: { lte: day },
        OR: [{ firedAt: null }, { firedAt: { gt: day } }],
      },
      select: { buildingId: true, monthlySalaryFinal: true },
    });
    const payrollByBuilding = new Map<string, Decimal>();
    for (const s of staff) {
      const cur = payrollByBuilding.get(s.buildingId) ?? new Decimal(0);
      payrollByBuilding.set(s.buildingId, cur.add(s.monthlySalaryFinal));
    }
    let payrollTotal = new Decimal(0);
    const payrollRows: string[] = [];
    for (const b of buildings) {
      const amount = payrollByBuilding.get(b.id);
      if (amount && amount.gt(0)) {
        payrollRows.push(`${buildingLabel(b)}: ${formatUsd(amount)}`);
        payrollTotal = payrollTotal.add(amount);
      }
    }
    const payrollLines = [
      `Payroll processed (${dateStr})`,
      ...payrollRows,
      '',
      `Total payroll: ${formatUsd(payrollTotal)}`,
    ];
    bodyParts.push(payrollLines.join('\n'));
  }

  if (costResult.rentPosted) {
    const rentByBuilding = new Map<string, Decimal>();
    for (const b of buildings) {
      const states = await prisma.buildingMetricState.findMany({
        where: { buildingId: b.id },
        select: { rentPerMonthly: true },
        orderBy: { metricType: 'asc' },
      });
      const firstRent = states.find((s) => s.rentPerMonthly != null)?.rentPerMonthly;
      if (firstRent != null && firstRent.gt(0)) {
        rentByBuilding.set(b.id, firstRent);
      }
    }
    let rentTotal = new Decimal(0);
    const rentRows: string[] = [];
    for (const b of buildings) {
      const amount = rentByBuilding.get(b.id);
      if (amount) {
        rentRows.push(`${buildingLabel(b)}: ${formatUsd(amount)}`);
        rentTotal = rentTotal.add(amount);
      }
    }
    const rentLines = [
      `Rent posted (${dateStr})`,
      ...rentRows,
      '',
      `Total rent: ${formatUsd(rentTotal)}`,
    ];
    bodyParts.push(rentLines.join('\n'));
  }

  if (costResult.overheadPosted) {
    const overheadByBuilding = new Map<string, Decimal>();
    for (const b of buildings) {
      const states = await prisma.buildingMetricState.findMany({
        where: { buildingId: b.id },
        select: { overheadMonthly: true },
        orderBy: { metricType: 'asc' },
      });
      const firstOverhead = states.find((s) => s.overheadMonthly != null)?.overheadMonthly;
      if (firstOverhead != null && firstOverhead.gt(0)) {
        overheadByBuilding.set(b.id, firstOverhead);
      }
    }
    let overheadTotal = new Decimal(0);
    const overheadRows: string[] = [];
    for (const b of buildings) {
      const amount = overheadByBuilding.get(b.id);
      if (amount) {
        overheadRows.push(`${buildingLabel(b)}: ${formatUsd(amount)}`);
        overheadTotal = overheadTotal.add(amount);
      }
    }
    const overheadLines = [
      `Overhead posted (${dateStr})`,
      ...overheadRows,
      '',
      `Total overhead: ${formatUsd(overheadTotal)}`,
    ];
    bodyParts.push(overheadLines.join('\n'));
  }

  const body = bodyParts.join('\n\n');

  const ledgerEntries = await prisma.companyLedgerEntry.findMany({
    where: {
      companyId,
      dayKey: day,
      direction: FinanceDirection.OUT,
      category: { in: [FinanceCategory.PAYROLL, FinanceCategory.RENT, FinanceCategory.OVERHEAD] },
    },
    select: { category: true, amountUsd: true },
  });
  const ledgerPayroll = ledgerEntries
    .filter((e) => e.category === FinanceCategory.PAYROLL)
    .reduce((s, e) => s.add(e.amountUsd), new Decimal(0));
  const ledgerRent = ledgerEntries
    .filter((e) => e.category === FinanceCategory.RENT)
    .reduce((s, e) => s.add(e.amountUsd), new Decimal(0));
  const ledgerOverhead = ledgerEntries
    .filter((e) => e.category === FinanceCategory.OVERHEAD)
    .reduce((s, e) => s.add(e.amountUsd), new Decimal(0));

  try {
    await prisma.playerMessage.create({
      data: {
        playerId: company.playerId,
        category: MessageCategory.OPERATION,
        department: DepartmentCode.FINANCE,
        level: MessageLevel.INFO,
        kind: MessageKind.INFO,
        title: 'Monthly expenses posted',
        body,
        context: {
          companyId,
          dayKey: day.toISOString().split('T')[0],
          payrollTotalUsd: ledgerPayroll.toNumber(),
          rentTotalUsd: ledgerRent.toNumber(),
          overheadTotalUsd: ledgerOverhead.toNumber(),
        },
        dedupeKey,
      },
    });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    if (code === 'P2002') return;
    throw err;
  }
}
