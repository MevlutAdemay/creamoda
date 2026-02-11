// app/player/page.tsx – Home: guidance (flow/simple) OR 3-column dashboard

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, DepartmentCode, MetricType } from '@prisma/client';
import { getCompanyGameDayKey, formatDayKeyString } from '@/lib/game/game-clock';
import {
  getSalesSeasonWindow,
  getCurrentSalesWindow,
  getOpenCollectionWindows,
  getCurrentSalesSeason,
  type Hemisphere as CalendarHemisphere,
} from '@/lib/game/season-calendar';
import { evaluateGuidance } from '@/lib/game/guidance-rules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ShoppingBag, Warehouse } from 'lucide-react';
import { HomeContent } from './_components/HomeContent';
import { WeekSimHeader } from '@/components/player/week-sim-header';

async function getCollectionCountsByCycleKey(
  companyId: string,
  hemisphere: CalendarHemisphere
): Promise<Record<string, number>> {
  const keyField = hemisphere === 'NORTH' ? 'northCollectionKey' : 'southCollectionKey';
  const rows = await prisma.playerProduct.groupBy({
    by: [keyField],
    where: {
      companyId,
      isActive: true,
      isUnlocked: true,
      [keyField]: { not: null },
    },
    _count: { id: true },
  });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = row[keyField];
    if (key != null) counts[key] = row._count.id;
  }
  return counts;
}

async function getStaffNames(companyId: string): Promise<{
  designStaffName: string | null;
  buyingStaffName: string | null;
}> {
  const design = await prisma.companyStaff.findFirst({
    where: { companyId, departmentCode: DepartmentCode.DESIGN, firedAt: null },
    select: { fullName: true },
    orderBy: { hiredAt: 'asc' },
  });
  const buying = await prisma.companyStaff.findFirst({
    where: { companyId, departmentCode: DepartmentCode.MERCHANDISING, firedAt: null },
    select: { fullName: true },
    orderBy: { hiredAt: 'asc' },
  });
  return {
    designStaffName: design?.fullName ?? null,
    buyingStaffName: buying?.fullName ?? null,
  };
}

async function getWarehouseMetrics(warehouseId: string): Promise<{
  salesCount: number;
  stockCount: number;
}> {
  const states = await prisma.buildingMetricState.findMany({
    where: {
      buildingId: warehouseId,
      metricType: { in: [MetricType.SALES_COUNT, MetricType.STOCK_COUNT] },
    },
    select: { metricType: true, currentCount: true },
  });
  let salesCount = 0;
  let stockCount = 0;
  for (const s of states) {
    if (s.metricType === MetricType.SALES_COUNT) salesCount = s.currentCount;
    if (s.metricType === MetricType.STOCK_COUNT) stockCount = s.currentCount;
  }
  return { salesCount, stockCount };
}

export default async function PlayerPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  if (session.user.role === 'SUPER_ADMIN' || session.user.role === 'CONTENT_MANAGER') {
    redirect('/admin/dashboard');
  }

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!company) redirect('/wizard');

  const dayKey = await getCompanyGameDayKey(company.id);
  const dayKeyStr = formatDayKeyString(dayKey);

  const firstWarehouse = await prisma.companyBuilding.findFirst({
    where: { companyId: company.id, role: BuildingRole.WAREHOUSE },
    select: { id: true, name: true, country: { select: { hemisphere: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const hemisphere: CalendarHemisphere =
    firstWarehouse?.country?.hemisphere === 'SOUTH' ? 'SOUTH' : 'NORTH';

  const [collectionCountsByCycleKey, staff, openCollections, activeSalesSeason, warehouseMetrics] =
    await Promise.all([
      getCollectionCountsByCycleKey(company.id, hemisphere),
      getStaffNames(company.id),
      Promise.resolve(getOpenCollectionWindows(dayKeyStr, hemisphere)),
      Promise.resolve(getCurrentSalesSeason(dayKeyStr, hemisphere)),
      firstWarehouse ? getWarehouseMetrics(firstWarehouse.id) : Promise.resolve({ salesCount: 0, stockCount: 0 }),
    ]);

  const guidanceCards = evaluateGuidance({
    dayKey: dayKeyStr,
    hemisphere,
    openCollections,
    collectionCountsByCycleKey,
    activeSalesSeason,
    staff,
  });

  const salesResult = getSalesSeasonWindow(dayKeyStr, hemisphere, { strict: false });
  const currentSales = salesResult?.current ?? getCurrentSalesWindow(dayKeyStr, hemisphere);

  const playerName = session.user.name ?? session.user.email ?? 'Player';

  return (
    <div className="min-h-full">
      <div className="max-w-3xl ml-4 bg-transparent">
      <WeekSimHeader />
      </div>
      <div className="container mx-auto px-4 py-8 min-w-full">
        <HomeContent guidanceCards={guidanceCards}>
          {/* ---- 3-COLUMN DASHBOARD (shown when no active guidance) ---- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="max-w-3xl ml-4 bg-transparent">
            {/* LEFT: Welcome */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Welcome</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Player</span>
                  <span className="font-medium truncate max-w-[180px]">{playerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium truncate max-w-[180px]">{company.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hemisphere</span>
                  <Badge variant="secondary" className="font-normal text-xs">
                    {hemisphere === 'NORTH' ? 'North' : 'South'}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Season</span>
                  <span className="font-medium">
                    {currentSales
                      ? `${currentSales.season} · ${currentSales.label}`
                      : 'No active season'}
                  </span>
                </div>
              </CardContent>
            </Card>
            </div>
            {/* CENTER: Collection cards (one per open window) */}
            <div className="space-y-4">
              {openCollections.length === 0 ? (
                <Card>
                  <CardContent className="py-6">
                    <p className="text-sm text-muted-foreground">No open collection window.</p>
                  </CardContent>
                </Card>
              ) : (
                openCollections.map((w) => {
                  const season = w.seasonType === 'FW' ? 'WINTER' : 'SUMMER';
                  const count = collectionCountsByCycleKey[w.cycleKey] ?? 0;
                  return (
                    <Card key={w.cycleKey}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Package className="h-5 w-5 text-muted-foreground" />
                          {w.label}
                        </CardTitle>
                        <CardDescription>Ends: {w.endDayKey}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Season</span>
                          <span className="font-medium">{season}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Products</span>
                          <span className="font-medium tabular-nums">{count}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button asChild variant="default" size="sm">
                            <Link href={`/player/collections?season=${season}`}>
                              Add Products
                            </Link>
                          </Button>
                          {/* TODO: wire to dedicated collection detail page */}
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/player/production-plans?season=${season}`}>Production Plan</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
            <div className="max-w-3xl ml-4 bg-transparent">
            {/* RIGHT: Active Warehouse */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Warehouse className="h-5 w-5 text-muted-foreground" />
                  {firstWarehouse?.name ?? 'Warehouse'}
                </CardTitle>
                <CardDescription>Daily metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!firstWarehouse ? (
                  <p className="text-sm text-muted-foreground">No warehouse found.</p>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sales Count</span>
                      <span className="font-medium tabular-nums">{warehouseMetrics.salesCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stock Count</span>
                      <span className="font-medium tabular-nums">{warehouseMetrics.stockCount}</span>
                    </div>
                  </>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild variant="default" size="sm">
                    <Link href="/player/sales">
                      <ShoppingBag className="h-4 w-4 mr-1" />
                      ShowCase
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/player/warehouse">
                      <Warehouse className="h-4 w-4 mr-1" />
                      Warehouse
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </HomeContent>
      </div>
    </div>
  );
}
