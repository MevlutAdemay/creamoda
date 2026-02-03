/**
 * Part-time backlog clearing: charge player, clear backlog FIFO (no inventory decrement).
 * POST { buildingId, staffCount, idempotencyKey? }
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, MetricType } from '@prisma/client';
import {
  FinanceDirection,
  FinanceCategory,
  FinanceScopeType,
  FinanceCounterpartyType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { postLedgerEntryAndUpdateWallet } from '@/lib/finance/helpers';
import { normalizeUtcMidnight } from '@/lib/game/game-clock';

const CAPACITY_PER_WORKER = 20;
const BASE_COST_PER_WORKER = 60;
const STAFF_COUNT_MAX = 200;

function parseClearedUnitsFromNote(note: string | null): number {
  if (!note) return 0;
  const m = note.match(/clearedUnits=(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { buildingId?: string; staffCount?: number; idempotencyKey?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const buildingId = body.buildingId?.trim() ?? '';
    const staffCountRaw = typeof body.staffCount === 'number' ? body.staffCount : parseInt(String(body.staffCount ?? 0), 10);
    const staffCount = Math.max(0, Math.min(STAFF_COUNT_MAX, Number.isNaN(staffCountRaw) ? 0 : staffCountRaw));
    const clientIdempotencyKey = body.idempotencyKey?.trim() ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: { playerId: session.user!.id },
        select: { id: true, playerId: true },
      });
      if (!company?.playerId) {
        return { error: 'Company not found', status: 404 as const };
      }
      const companyId = company.id;

      const building = await tx.companyBuilding.findFirst({
        where: {
          id: buildingId,
          companyId,
          role: BuildingRole.WAREHOUSE,
        },
        select: { id: true, countryId: true, marketZone: true },
      });
      if (!building) {
        return { error: 'Warehouse not found', status: 404 as const };
      }

      const clock = await tx.companyGameClock.findUnique({
        where: { companyId },
        select: { currentDayKey: true },
      });
      if (!clock) {
        return { error: 'Game clock not found', status: 400 as const };
      }
      const currentDayKey = normalizeUtcMidnight(clock.currentDayKey);

      const country = building.countryId
        ? await tx.country.findUnique({
            where: { id: building.countryId },
            select: { salaryMultiplier: true },
          })
        : null;
      const salaryMultiplier = country?.salaryMultiplier ? Number(country.salaryMultiplier) : 1;

      if (staffCount === 0) {
        return {
          success: true as const,
          buildingId,
          dayKey: currentDayKey.toISOString(),
          staffCount: 0,
          salaryMultiplier,
          costUsd: 0,
          requestedClearUnits: 0,
          clearedUnits: 0,
          backlogBefore: 0,
          backlogAfter: 0,
          balanceUsdAfter: 0,
        };
      }

      const allBacklogCandidates = await tx.modaverseOrderItem.findMany({
        where: {
          order: { warehouseBuildingId: buildingId, companyId },
        },
        select: {
          id: true,
          orderId: true,
          listingId: true,
          productTemplateId: true,
          playerProductId: true,
          qtyOrdered: true,
          qtyFulfilled: true,
          qtyShipped: true,
          sortIndex: true,
          order: { select: { dayKey: true } },
        },
        orderBy: [{ order: { dayKey: 'asc' } }, { sortIndex: 'asc' }],
      });

      const backlogItems = allBacklogCandidates.filter(
        (i) => i.qtyFulfilled < i.qtyOrdered
      );
      const backlogUnitsTotal = backlogItems.reduce(
        (s, i) => s + (i.qtyOrdered - i.qtyFulfilled),
        0
      );
      const clearUnitsTarget = Math.min(backlogUnitsTotal, staffCount * CAPACITY_PER_WORKER);
      const costUsd = staffCount * BASE_COST_PER_WORKER * salaryMultiplier;

      const wallet = await tx.playerWallet.findUnique({
        where: { userId: company.playerId },
        select: { balanceUsd: true },
      });
      const balanceUsd = wallet?.balanceUsd ?? new Decimal(0);
      if (balanceUsd.lt(costUsd)) {
        return { error: 'Insufficient USD', status: 400 as const };
      }

      const dayKeyStr = currentDayKey.toISOString().split('T')[0];
      const idempotencyKey =
        clientIdempotencyKey ??
        `PART_TIME:${companyId}:${buildingId}:${dayKeyStr}:${staffCount}`;

      const ledgerResult = await postLedgerEntryAndUpdateWallet(tx, company.playerId, {
        companyId,
        dayKey: currentDayKey,
        direction: FinanceDirection.OUT,
        amountUsd: costUsd,
        category: FinanceCategory.PART_TIME,
        scopeType: FinanceScopeType.BUILDING,
        scopeId: buildingId,
        counterpartyType: FinanceCounterpartyType.SYSTEM,
        counterpartyId: null,
        refType: 'PART_TIME_BACKLOG_CLEAR',
        refId: buildingId,
        idempotencyKey,
        note: `PART_TIME staffCount=${staffCount}, clearedUnits=0`,
      });

      if (!ledgerResult.isNew) {
        const existingCleared = parseClearedUnitsFromNote(ledgerResult.entry.note);
        const walletAfter = await tx.playerWallet.findUnique({
          where: { userId: company.playerId },
          select: { balanceUsd: true },
        });
        return {
          success: true as const,
          buildingId,
          dayKey: currentDayKey.toISOString(),
          staffCount,
          salaryMultiplier,
          costUsd: Number(ledgerResult.entry.amountUsd),
          requestedClearUnits: staffCount * CAPACITY_PER_WORKER,
          clearedUnits: existingCleared,
          backlogBefore: backlogUnitsTotal + existingCleared,
          backlogAfter: backlogUnitsTotal,
          balanceUsdAfter: walletAfter ? Number(walletAfter.balanceUsd) : 0,
        };
      }

      let remainingToClear = clearUnitsTarget;
      let actualCleared = 0;
      const warehouseMarketZone = building.marketZone ?? 'USA';

      for (const item of backlogItems) {
        if (remainingToClear <= 0) break;
        const remaining = item.qtyOrdered - item.qtyFulfilled;
        const ship = Math.min(remaining, remainingToClear);
        if (ship <= 0) continue;

        await tx.modaverseOrderItem.update({
          where: { id: item.id },
          data: {
            qtyFulfilled: { increment: ship },
            qtyShipped: { increment: ship },
          },
        });

        const orderDayKey = item.order.dayKey;
        if (item.listingId) {
          await tx.dailyProductSalesLog.upsert({
            where: {
              listingKey_dayKey: {
                listingKey: item.listingId,
                dayKey: orderDayKey,
              },
            },
            create: {
              companyId,
              listingKey: item.listingId,
              listingId: item.listingId,
              marketZone: warehouseMarketZone,
              warehouseBuildingId: buildingId,
              productTemplateId: item.productTemplateId,
              playerProductId: item.playerProductId ?? '',
              dayKey: orderDayKey,
              qtyOrdered: 0,
              qtyShipped: ship,
            },
            update: { qtyShipped: { increment: ship } },
          });
        }

        remainingToClear -= ship;
        actualCleared += ship;
      }

      await tx.companyLedgerEntry.update({
        where: { idempotencyKey },
        data: {
          note: `PART_TIME staffCount=${staffCount}, clearedUnits=${actualCleared}`,
        },
      });

      await tx.buildingMetricState.upsert({
        where: {
          buildingId_metricType: {
            buildingId,
            metricType: MetricType.SALES_COUNT,
          },
        },
        create: {
          buildingId,
          metricType: MetricType.SALES_COUNT,
          currentCount: actualCleared,
          currentLevel: 1,
          lastEvaluatedAt: new Date(),
        },
        update: {
          currentCount: { increment: actualCleared },
          lastEvaluatedAt: new Date(),
        },
      });

      const walletAfter = await tx.playerWallet.findUnique({
        where: { userId: company.playerId },
        select: { balanceUsd: true, balanceXp: true, balanceDiamond: true },
      });

      return {
        success: true as const,
        buildingId,
        dayKey: currentDayKey.toISOString(),
        staffCount,
        salaryMultiplier,
        costUsd,
        requestedClearUnits: staffCount * CAPACITY_PER_WORKER,
        clearedUnits: actualCleared,
        backlogBefore: backlogUnitsTotal,
        backlogAfter: backlogUnitsTotal - actualCleared,
        balanceUsdAfter: walletAfter ? Number(walletAfter.balanceUsd) : 0,
        wallet: walletAfter
          ? {
              balanceUsd: Number(walletAfter.balanceUsd),
              balanceXp: walletAfter.balanceXp,
              balanceDiamond: walletAfter.balanceDiamond,
            }
          : null,
      };
    });

    if ('error' in result && 'status' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error('[part-time-apply]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Part-time apply failed' },
      { status: 500 }
    );
  }
}
