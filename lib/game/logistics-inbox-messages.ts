/**
 * Logistics inbox message helpers. Run only outside Prisma transactions using plain prisma.
 * Idempotent via dedupeKey; use findUnique + create with P2002 catch for race safety.
 */

import prisma from '@/lib/prisma';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';
import { MessageCategory, MessageLevel, MessageKind, DepartmentCode, MessageCtaType } from '@prisma/client';
import { BuildingRole, MetricType } from '@prisma/client';

/** Warehouse label: name if present, otherwise "Warehouse - {marketZone}" (underscores replaced with space). */
function warehouseLabel(name: string | null, marketZone: string | null): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const zone = (marketZone ?? '—').toString().replace(/_/g, ' ');
  return `Warehouse - ${zone}`;
}

/**
 * Create at most one LOGISTICS (OPERATION) backlog warning message per warehouse per day
 * when backlog remains after the warehouse day tick.
 * Call this AFTER runWarehouseDayTick completes (outside any Prisma transaction).
 *
 * - If backlogAfter <= 0: no message.
 * - Level: WARNING if backlogDaysEq <= 3, CRITICAL if backlogDaysEq > 3.
 * - dedupeKey: BACKLOG_WARNING:{companyId}:{buildingId}:{YYYY-MM-DD}
 */
export async function createBacklogWarningMessageIfNeeded(
  companyId: string,
  buildingId: string,
  dayKey: Date
): Promise<void> {
  const day = normalizeUtcMidnight(dayKey);
  const dayStr = day.toISOString().split('T')[0];
  const dedupeKey = `BACKLOG_WARNING:${companyId}:${buildingId}:${dayStr}`;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { playerId: true },
  });
  if (!company?.playerId) return;

  const existing = await prisma.playerMessage.findUnique({
    where: { playerId_dedupeKey: { playerId: company.playerId, dedupeKey } },
  });
  if (existing) return;

  const orderItems = await prisma.modaverseOrderItem.findMany({
    where: {
      order: {
        warehouseBuildingId: buildingId,
        companyId,
      },
    },
    select: { qtyOrdered: true, qtyFulfilled: true },
  });

  let backlogAfter = 0;
  for (const item of orderItems) {
    if (item.qtyFulfilled < item.qtyOrdered) {
      backlogAfter += item.qtyOrdered - item.qtyFulfilled;
    }
  }

  if (backlogAfter <= 0) return;

  const metricState = await prisma.buildingMetricState.findUnique({
    where: {
      buildingId_metricType: {
        buildingId,
        metricType: MetricType.SALES_COUNT,
      },
    },
    select: { currentLevel: true },
  });

  const currentLevel = metricState?.currentLevel ?? 1;

  const [building, levelConfig] = await Promise.all([
    prisma.companyBuilding.findUnique({
      where: { id: buildingId },
      select: { name: true, marketZone: true },
    }),
    prisma.metricLevelConfig.findFirst({
      where: {
        buildingRole: BuildingRole.WAREHOUSE,
        metricType: MetricType.SALES_COUNT,
        level: currentLevel,
      },
      select: { maxAllowed: true },
    }),
  ]);

  const capacity = levelConfig?.maxAllowed ?? 0;
  const backlogDaysEq = capacity > 0 ? backlogAfter / capacity : Infinity;
  const level = backlogDaysEq > 3 ? MessageLevel.CRITICAL : MessageLevel.WARNING;

  const label = warehouseLabel(
    building?.name ?? null,
    building?.marketZone ?? null
  );

  const body = `${label}: Orders exceeded daily shipping capacity.
Backlog remaining: ${backlogAfter} units
Today's capacity: ${capacity} units
Suggested action: Review Logistics or use part-time staff to clear backlog.`;

  const context = {
    buildingId,
    dayKey: dayStr,
    backlogAfter,
    capacity,
    backlogDaysEq: backlogDaysEq === Infinity ? null : backlogDaysEq,
  };

  try {
    await prisma.playerMessage.create({
      data: {
        playerId: company.playerId,
        category: MessageCategory.OPERATION,
        department: DepartmentCode.LOGISTICS,
        level,
        kind: MessageKind.ACTION,
        title: 'Backlog warning – capacity exceeded',
        body,
        context: context as object,
        ctaType: MessageCtaType.GO_TO_PAGE,
        ctaLabel: 'Open Logistics',
        ctaPayload: {
          route: '/player/warehouse/logistics',
          buildingId,
        } as object,
        dedupeKey,
      },
    });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    if (code === 'P2002') return;
    throw err;
  }
}
