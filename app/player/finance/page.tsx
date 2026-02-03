/**
 * Finance Operations (CFO) page V1 – Server Component.
 * Data from CompanyLedgerEntry; filters via URL params.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, FinanceCategory, FinanceDirection, FinanceScopeType } from '@prisma/client';
import { DepartmentCode } from '@prisma/client';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { formatDayKeyString } from '@/lib/game/game-clock';
import { getDateRangeForRangeKey, type RangeKey } from './_lib/date-range';
import type { FinancePageData } from './_lib/types';
import { FinanceFilters } from './_components/finance-filters';
import { FinanceKpiCards } from './_components/kpi-cards';
import { CashflowLineChart } from './_components/cashflow-line-chart';
import { ExpenseBreakdownChart } from './_components/expense-breakdown-chart';
import { LedgerTable } from './_components/ledger-table';
import { BuildingSummaryTable } from './_components/building-summary-table';
import { FinanceInboxPanel } from './_components/finance-inbox-panel';
import { DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

const RANGE_OPTIONS: RangeKey[] = ['all', '14d', '30d', 'thisMonth', 'prevMonth'];
const CATEGORIES = [
  'all',
  'PAYROLL',
  'RENT',
  'OVERHEAD',
  'PROCUREMENT',
  'WHOLESALE',
  'MARKETING',
  'LOGISTICS',
  'PART_TIME',
  'CAPEX',
  'OTHER',
] as const;

function buildingLabel(role: BuildingRole, name: string | null, marketZone: string | null): string {
  const suffix = name?.trim() || (role === BuildingRole.HQ ? 'Management' : marketZone || '—');
  return role === BuildingRole.HQ ? `HQ – ${suffix}` : `Warehouse – ${suffix}`;
}

function getSettlementsLink(scope: string, scopeId: string | null): string {
  const params = new URLSearchParams();
  if (scope === 'company' || scope === 'hq') {
    params.set('group', 'company');
  } else {
    params.set('group', 'warehouse');
    if (scopeId) params.set('warehouseBuildingId', scopeId);
  }
  return `/player/finance/settlements?${params.toString()}`;
}

const LEDGER_PAGE_SIZE = 200;
const AGGREGATION_CAP = 10000;

type PageProps = {
  searchParams: Promise<{ range?: string; scope?: string; scopeId?: string; category?: string; cursor?: string }> | { range?: string; scope?: string; scopeId?: string; category?: string; cursor?: string };
};

export default async function FinancePage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const hasKnownParams = params.range !== undefined || params.scope !== undefined || params.scopeId !== undefined || params.category !== undefined || params.cursor !== undefined;
  if (!hasKnownParams) {
    redirect('/player/finance?range=all&scope=company&category=all');
  }
  const rangeParam = (params.range?.trim() || 'all') as RangeKey;
  const range = RANGE_OPTIONS.includes(rangeParam) ? rangeParam : 'all';
  const scope = (params.scope?.trim() || 'company') as string;
  const scopeId = params.scopeId?.trim() || null;
  const categoryParam = params.category?.trim() || 'all';
  const category = CATEGORIES.includes(categoryParam as (typeof CATEGORIES)[number]) ? categoryParam : 'all';
  const cursor = params.cursor?.trim() || null;

  const [buildings, currentDayKey, inboxMessages] = await Promise.all([
    prisma.companyBuilding.findMany({
      where: { companyId: company.id },
      select: { id: true, role: true, name: true, marketZone: true },
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    }),
    getCompanyGameDayKey(company.id),
    prisma.playerMessage.findMany({
      where: {
        playerId: session.user.id,
        department: DepartmentCode.FINANCE,
      },
      select: { id: true, createdAt: true, title: true, body: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const dateRange = getDateRangeForRangeKey(range, currentDayKey);
  const ledgerWhere: {
    companyId: string;
    dayKey?: { gte: Date; lte: Date };
    scopeType?: FinanceScopeType;
    scopeId?: string | { in: string[] };
    category?: FinanceCategory;
  } = {
    companyId: company.id,
  };
  if (dateRange) {
    ledgerWhere.dayKey = { gte: dateRange.start, lte: dateRange.end };
  }
  const warehouseIds = buildings.filter((b) => b.role === BuildingRole.WAREHOUSE).map((b) => b.id);
  const hqIds = buildings.filter((b) => b.role === BuildingRole.HQ).map((b) => b.id);
  if (scope === 'warehouse') {
    if (scopeId && warehouseIds.includes(scopeId)) {
      ledgerWhere.scopeType = FinanceScopeType.BUILDING;
      ledgerWhere.scopeId = scopeId;
    } else {
      ledgerWhere.scopeType = FinanceScopeType.BUILDING;
      ledgerWhere.scopeId = { in: warehouseIds };
    }
  } else if (scope === 'hq') {
    if (hqIds.length > 0) {
      ledgerWhere.scopeType = FinanceScopeType.BUILDING;
      if (scopeId && hqIds.includes(scopeId)) {
        ledgerWhere.scopeId = scopeId;
      } else {
        ledgerWhere.scopeId = { in: hqIds };
      }
    }
  }
  if (category !== 'all') {
    ledgerWhere.category = category as FinanceCategory;
  }

  const [aggregationEntries, ledgerPage] = await Promise.all([
    prisma.companyLedgerEntry.findMany({
      where: ledgerWhere,
      select: {
        id: true,
        dayKey: true,
        direction: true,
        amountUsd: true,
        category: true,
        scopeType: true,
        scopeId: true,
      },
      orderBy: [{ dayKey: 'desc' }, { createdAt: 'desc' }],
      take: AGGREGATION_CAP,
    }),
    prisma.companyLedgerEntry.findMany({
      where: ledgerWhere,
      select: {
        id: true,
        dayKey: true,
        direction: true,
        amountUsd: true,
        category: true,
        scopeType: true,
        scopeId: true,
        refType: true,
        refId: true,
        note: true,
        idempotencyKey: true,
      },
      orderBy: [{ dayKey: 'desc' }, { createdAt: 'desc' }],
      take: LEDGER_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMoreLedger = ledgerPage.length > LEDGER_PAGE_SIZE;
  const ledgerEntriesForTable = hasMoreLedger ? ledgerPage.slice(0, LEDGER_PAGE_SIZE) : ledgerPage;
  const ledgerNextCursor = hasMoreLedger ? ledgerPage[LEDGER_PAGE_SIZE - 1]?.id ?? null : null;
  const scopeIdForTable = scopeId ?? null;
  const categoryForTable = category === 'all' ? null : category;
  const ledgerEntries = aggregationEntries;

  const buildingMap = new Map(
    buildings.map((b) => [
      b.id,
      { name: buildingLabel(b.role, b.name, b.marketZone), buildingType: b.role === BuildingRole.HQ ? ('HQ' as const) : ('WAREHOUSE' as const) },
    ])
  );

  let totalIn = 0;
  let totalOut = 0;
  const byDay = new Map<string, { inUsd: number; outUsd: number }>();
  const byCategory = new Map<string, number>();
  const byBuilding = new Map<string, number>();

  for (const e of ledgerEntries) {
    const amt = Number(e.amountUsd);
    if (e.direction === FinanceDirection.IN) {
      totalIn += amt;
    } else {
      totalOut += amt;
      const cat = e.category;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + amt);
      if (e.scopeType === FinanceScopeType.BUILDING && e.scopeId) {
        byBuilding.set(e.scopeId, (byBuilding.get(e.scopeId) ?? 0) + amt);
      }
    }
    const dayStr = formatDayKeyString(e.dayKey);
    const day = byDay.get(dayStr) ?? { inUsd: 0, outUsd: 0 };
    if (e.direction === FinanceDirection.IN) day.inUsd += amt;
    else day.outUsd += amt;
    byDay.set(dayStr, day);
  }

  const net = totalIn - totalOut;
  let biggestExpenseCategory: string | null = null;
  let maxOut = 0;
  for (const [cat, amount] of byCategory) {
    if (amount > maxOut) {
      maxOut = amount;
      biggestExpenseCategory = cat;
    }
  }

  const sortedDays = Array.from(byDay.keys()).sort();
  const timeline = sortedDays.map((dayKey) => {
    const d = byDay.get(dayKey)!;
    return {
      dayKey,
      inUsd: d.inUsd,
      outUsd: d.outUsd,
      netUsd: d.inUsd - d.outUsd,
    };
  });

  const expenseByCategory = Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount }));

  const byBuildingInOut = new Map<string, { inUsd: number; outUsd: number }>();
  for (const e of ledgerEntries) {
    if (e.scopeType === FinanceScopeType.BUILDING && e.scopeId) {
      const cur = byBuildingInOut.get(e.scopeId) ?? { inUsd: 0, outUsd: 0 };
      const amt = Number(e.amountUsd);
      if (e.direction === FinanceDirection.IN) cur.inUsd += amt;
      else cur.outUsd += amt;
      byBuildingInOut.set(e.scopeId, cur);
    }
  }
  const buildingsToShow: { id: string; name: string; type: 'WAREHOUSE' | 'HQ' }[] = [];
  if (scope === 'company') {
    buildingsToShow.push(...buildings.map((b) => ({ id: b.id, name: buildingLabel(b.role, b.name, b.marketZone), type: b.role === BuildingRole.HQ ? ('HQ' as const) : ('WAREHOUSE' as const) })));
  } else if (scope === 'warehouse') {
    const list = scopeId && warehouseIds.includes(scopeId) ? buildings.filter((b) => b.id === scopeId) : buildings.filter((b) => b.role === BuildingRole.WAREHOUSE);
    list.forEach((b) => buildingsToShow.push({ id: b.id, name: buildingLabel(b.role, b.name, b.marketZone), type: 'WAREHOUSE' }));
  } else if (scope === 'hq') {
    const list = scopeId && hqIds.includes(scopeId) ? buildings.filter((b) => b.id === scopeId) : buildings.filter((b) => b.role === BuildingRole.HQ);
    list.forEach((b) => buildingsToShow.push({ id: b.id, name: buildingLabel(b.role, b.name, b.marketZone), type: 'HQ' }));
  }
  const buildingSummary = buildingsToShow.map((b) => {
    const io = byBuildingInOut.get(b.id) ?? { inUsd: 0, outUsd: 0 };
    return {
      buildingId: b.id,
      buildingName: b.name,
      buildingType: b.type,
      totalIn: io.inUsd,
      totalOut: io.outUsd,
      net: io.inUsd - io.outUsd,
    };
  });

  const tableRows = ledgerEntriesForTable.map((e) => {
    const scopeLabel =
      e.scopeType === FinanceScopeType.COMPANY
        ? 'Company'
        : e.scopeId
          ? buildingMap.get(e.scopeId)?.name ?? e.scopeId
          : '—';
    return {
      id: e.id,
      dayKey: formatDayKeyString(e.dayKey),
      category: e.category,
      direction: e.direction as 'IN' | 'OUT',
      amount: Number(e.amountUsd),
      scopeLabel,
      refType: e.refType ?? null,
      note: e.note ?? null,
      scopeType: e.scopeType,
      scopeId: e.scopeId ?? null,
      idempotencyKey: e.idempotencyKey ?? null,
      refId: e.refId ?? null,
    };
  });

  const data: FinancePageData = {
    range,
    scope,
    scopeId: scopeId || null,
    category: category === 'all' ? null : category,
    kpis: {
      net,
      totalIn,
      totalOut,
      biggestExpenseCategory,
    },
    timeline,
    expenseByCategory,
    buildingSummary,
    tableRows,
    ledgerHasMore: hasMoreLedger,
    ledgerNextCursor: ledgerNextCursor ?? null,
    inbox: inboxMessages.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      title: m.title,
      body: m.body,
      category: m.category ?? undefined,
    })),
  };

  const warehouseBuildings = buildings.filter((b) => b.role === BuildingRole.WAREHOUSE);
  const hqBuildings = buildings.filter((b) => b.role === BuildingRole.HQ);
  const scopeOptions: { value: string; label: string; scopeId?: string }[] = [
    { value: 'company', label: 'Company' },
    ...warehouseBuildings.map((b) => ({
      value: 'warehouse',
      scopeId: b.id,
      label: buildingLabel(b.role, b.name, b.marketZone),
    })),
    ...hqBuildings.map((b) => ({
      value: 'hq',
      scopeId: b.id,
      label: buildingLabel(b.role, b.name, b.marketZone),
    })),
  ];

  return (
    <div className="relative min-h-screen bg-transparent ">
      <div className="container mx-auto p-4 md:p-8 min-w-full">
        <div className="mx-auto max-w-6xl space-y-6 min-w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h5 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-lg md:text-xl">
              Finance Operations
            </h5>
            <FinanceFilters
              range={range}
              scope={scope}
              scopeId={scopeId}
              category={category === 'all' ? null : category}
              scopeOptions={scopeOptions}
            />
             <Button variant="outline" size="sm" asChild>
              <Link href={getSettlementsLink(scope, scopeId)}>
                <FileText className="h-4 w-4 mr-2" />
                Platforn Reports
              </Link>
            </Button>
          </div>
          <FinanceKpiCards kpis={data.kpis} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Cashflow Timeline</CardTitle>
                <CardDescription>Daily IN, OUT, and Net USD</CardDescription>
              </CardHeader>
              <CardContent>
                <CashflowLineChart data={data.timeline} />
              </CardContent>
            </Card>
            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Expense Breakdown</CardTitle>
                <CardDescription>OUT totals by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ExpenseBreakdownChart data={data.expenseByCategory} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="min-w-0 flex-1 lg:max-w-[70%]">
              <h2 className="text-lg font-semibold mb-2">Ledger</h2>
              <LedgerTable
                rows={data.tableRows}
                hasMore={data.ledgerHasMore ?? false}
                nextCursor={data.ledgerNextCursor ?? null}
                currentParams={{ range, scope, scopeId: scopeIdForTable, category: categoryForTable }}
              />
            </div>
            <div className="shrink-0 lg:w-[30%] lg:min-w-[280px]">
              <h2 className="text-lg font-semibold mb-2">Building Summary</h2>
              <BuildingSummaryTable rows={data.buildingSummary} />
            </div>
          </div>

          
          <FinanceInboxPanel items={data.inbox ?? []} />
        </div>
      </div>
    </div>
  );
}
