import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, MetricType } from '@prisma/client';
import { WarehouseHeader } from '../_components/WarehouseHeader';
import { WarehousePlaceholder } from '../_components/WarehousePlaceholder';
import { BarChart3 } from 'lucide-react';
import {
  getCompanyGameDayKey,
  normalizeUtcMidnight,
  formatDayKeyString,
} from '@/lib/game/game-clock';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ThroughputCapacityChart } from './_components/ThroughputCapacityChart';
import { BacklogHealthChart } from './_components/BacklogHealthChart';
import { StockFlowChart } from './_components/StockFlowChart';
import { FinanceCategory, FinanceScopeType } from '@prisma/client';
import { InventoryMovementType, InventorySourceType } from '@prisma/client';

type PageProps = {
  searchParams: Promise<{ buildingId?: string }> | { buildingId?: string };
};

const REPORT_DAYS = 14;
const ORDER_ITEMS_DAYS_LIMIT = 60;

function parseClearedUnitsFromNote(note: string | null): number {
  if (!note) return 0;
  const m = note.match(/clearedUnits=(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export default async function WarehouseReportsPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const queryBuildingId = params.buildingId?.trim() || null;

  const warehouses = await prisma.companyBuilding.findMany({
    where: { companyId: company.id, role: BuildingRole.WAREHOUSE },
    select: { id: true, role: true, marketZone: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const warehouseIds = warehouses.map((w) => w.id);
  const validBuildingId =
    queryBuildingId && warehouseIds.includes(queryBuildingId)
      ? queryBuildingId
      : warehouses[0]?.id ?? null;

  const selectedWarehouse = validBuildingId
    ? warehouses.find((w) => w.id === validBuildingId)
    : null;
  const roleToLabel = (r: string) => (r === 'HQ' ? 'HQ' : r === 'WAREHOUSE' ? 'Warehouse' : r.replace(/_/g, ' '));
  const warehouseLabel = selectedWarehouse
    ? roleToLabel(selectedWarehouse.role) +
      (selectedWarehouse.marketZone?.trim()
        ? ` – ${selectedWarehouse.marketZone.replace(/_/g, ' ')}`
        : '')
    : null;

  const basePath = '/player/warehouse';
  const backHref = validBuildingId ? `${basePath}?buildingId=${encodeURIComponent(validBuildingId)}` : basePath;

  if (!validBuildingId) {
    return (
      <div className="relative min-h-screen bg-transparent">
        <div className="container mx-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <WarehouseHeader
              warehouses={warehouses.map((w) => ({ id: w.id, role: w.role, marketZone: w.marketZone }))}
              currentBuildingId={validBuildingId}
              activeTab="reports"
              title={
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  <BarChart3 className="h-7 w-7 text-muted-foreground" />
                  Warehouse Reports
                </h1>
              }
              description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
            />
            <WarehousePlaceholder
              title="Warehouse Reports"
              bullets={[
                'Stock levels and turnover',
                'Movement history and audit',
                'Performance and KPIs',
                'Export and scheduled reports',
              ]}
              backHref={backHref}
              noWarehouse
            />
          </div>
        </div>
      </div>
    );
  }

  const currentDayKey = await getCompanyGameDayKey(company.id);
  const today = normalizeUtcMidnight(currentDayKey);
  const dayKeys: Date[] = [];
  for (let i = REPORT_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(normalizeUtcMidnight(d));
  }

  const minOrderDay = new Date(today);
  minOrderDay.setUTCDate(minOrderDay.getUTCDate() - ORDER_ITEMS_DAYS_LIMIT);
  const minOrderDayKey = normalizeUtcMidnight(minOrderDay);

  const metricState = await prisma.buildingMetricState.findUnique({
    where: {
      buildingId_metricType: {
        buildingId: validBuildingId,
        metricType: MetricType.SALES_COUNT,
      },
    },
    select: { currentLevel: true, currentCount: true },
  });

  const currentLevel = metricState?.currentLevel ?? 1;

  const [levelConfig, movements, ledgerEntries, orderItems] = await Promise.all([
    prisma.metricLevelConfig.findFirst({
      where: {
        buildingRole: BuildingRole.WAREHOUSE,
        metricType: MetricType.SALES_COUNT,
        level: currentLevel,
      },
      select: { maxAllowed: true },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        companyBuildingId: validBuildingId,
        dayKey: { gte: dayKeys[0], lte: dayKeys[dayKeys.length - 1] },
      },
      select: { dayKey: true, movementType: true, sourceType: true, qtyChange: true },
    }),
    prisma.companyLedgerEntry.findMany({
      where: {
        companyId: company.id,
        dayKey: { gte: dayKeys[0], lte: dayKeys[dayKeys.length - 1] },
        category: FinanceCategory.PART_TIME,
        scopeType: FinanceScopeType.BUILDING,
        scopeId: validBuildingId,
      },
      select: { dayKey: true, note: true },
    }),
    prisma.modaverseOrderItem.findMany({
      where: {
        order: {
          warehouseBuildingId: validBuildingId,
          companyId: company.id,
          dayKey: { gte: minOrderDayKey },
        },
      },
      include: {
        order: { select: { dayKey: true } },
      },
    }),
  ]);

  const capacityNow = levelConfig?.maxAllowed ?? 0;

  const shippedByDay = new Map<string, number>();
  const inboundByDay = new Map<string, number>();
  const outboundByDay = new Map<string, number>();
  for (const d of dayKeys) {
    const key = formatDayKeyString(d);
    shippedByDay.set(key, 0);
    inboundByDay.set(key, 0);
    outboundByDay.set(key, 0);
  }

  for (const m of movements) {
    const key = formatDayKeyString(m.dayKey);
    if (!shippedByDay.has(key)) continue;
    if (m.movementType === InventoryMovementType.IN) {
      inboundByDay.set(key, (inboundByDay.get(key) ?? 0) + m.qtyChange);
    } else {
      outboundByDay.set(key, (outboundByDay.get(key) ?? 0) + m.qtyChange);
      if (m.sourceType === InventorySourceType.SALES_FULFILLMENT) {
        shippedByDay.set(key, (shippedByDay.get(key) ?? 0) + m.qtyChange);
      }
    }
  }

  for (const e of ledgerEntries) {
    const key = formatDayKeyString(e.dayKey);
    if (shippedByDay.has(key)) {
      const cleared = parseClearedUnitsFromNote(e.note);
      shippedByDay.set(key, (shippedByDay.get(key) ?? 0) + cleared);
    }
  }

  const orderedByDay = new Map<string, number>();
  for (const d of dayKeys) orderedByDay.set(formatDayKeyString(d), 0);
  let backlogUnitsNow = 0;
  for (const item of orderItems) {
    backlogUnitsNow += item.qtyOrdered - item.qtyFulfilled;
    const orderDayKey = formatDayKeyString(item.order.dayKey);
    if (orderedByDay.has(orderDayKey)) {
      orderedByDay.set(orderDayKey, (orderedByDay.get(orderDayKey) ?? 0) + item.qtyOrdered);
    }
  }

  const series = dayKeys.map((d) => {
    const key = formatDayKeyString(d);
    return {
      dayKey: key,
      shipped: shippedByDay.get(key) ?? 0,
      capacity: capacityNow,
      ordered: orderedByDay.get(key) ?? 0,
      inbound: inboundByDay.get(key) ?? 0,
      outbound: outboundByDay.get(key) ?? 0,
    };
  });

  const kpis = {
    backlogUnitsNow,
    backlogDaysEquivalent: capacityNow > 0 ? backlogUnitsNow / capacityNow : 0,
    capacityNow,
  };

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6 min-w-full">
          <WarehouseHeader
            warehouses={warehouses.map((w) => ({ id: w.id, role: w.role, marketZone: w.marketZone }))}
            currentBuildingId={validBuildingId}
            activeTab="reports"
            title={
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                <BarChart3 className="h-7 w-7 text-muted-foreground" />
                Warehouse Reports
              </h1>
            }
            description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Throughput &amp; Capacity</CardTitle>
                <CardDescription>Last 14 days: shipped units vs daily capacity</CardDescription>
              </CardHeader>
              <CardContent>
                <ThroughputCapacityChart
                  data={series.map((s) => ({ dayKey: s.dayKey, shipped: s.shipped, capacity: s.capacity }))}
                />
              </CardContent>
            </Card>

            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Backlog Health</CardTitle>
                <CardDescription>KPI and ordered vs shipped (last 14 days)</CardDescription>
              </CardHeader>
              <CardContent>
                <BacklogHealthChart
                  data={series.map((s) => ({ dayKey: s.dayKey, ordered: s.ordered, shipped: s.shipped }))}
                  kpis={kpis}
                />
              </CardContent>
            </Card>

            <Card className="border bg-card shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Stock Flow</CardTitle>
                <CardDescription>Last 14 days: inbound vs outbound by day</CardDescription>
              </CardHeader>
              <CardContent>
                <StockFlowChart
                  data={series.map((s) => ({ dayKey: s.dayKey, inbound: s.inbound, outbound: s.outbound }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
