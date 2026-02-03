import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { WarehouseHeader } from '../_components/WarehouseHeader';
import { WarehousePlaceholder } from '../_components/WarehousePlaceholder';
import { formatDayKeyString } from '@/lib/game/game-clock';
import { RotateCcw } from 'lucide-react';
import { ReturnsPeriodSelect } from './_components/ReturnsPeriodSelect';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type PageProps = {
  searchParams: Promise<{ buildingId?: string; settlementId?: string }> | { buildingId?: string; settlementId?: string };
};

const SETTLEMENTS_TAKE = 12;
const TREND_TAKE = 6;
const MIN_SOLD_FOR_RATE = 10;
const TOP_PRODUCTS_LIMIT = 15;

function formatUsd(n: number | Decimal): string {
  const v = typeof n === 'number' ? n : Number(n);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export default async function WarehouseReturnsPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const queryBuildingId = params.buildingId?.trim() || null;
  const querySettlementId = params.settlementId?.trim() || null;

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
              activeTab="returns"
              title={
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  <RotateCcw className="h-7 w-7 text-muted-foreground" />
                  Warehouse Returns
                </h1>
              }
              description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
            />
            <WarehousePlaceholder
              title="Warehouse Returns"
              bullets={['Return analytics by settlement period']}
              backHref={backHref}
              noWarehouse
            />
          </div>
        </div>
      </div>
    );
  }

  const settlements = await prisma.modaverseSettlement.findMany({
    where: { companyId: company.id, warehouseBuildingId: validBuildingId },
    orderBy: { payoutDayKey: 'desc' },
    take: SETTLEMENTS_TAKE,
    select: { id: true, periodStartDayKey: true, periodEndDayKey: true, payoutDayKey: true },
  });

  const settlementIds = settlements.map((s) => s.id);
  const selectedSettlementId =
    querySettlementId && settlementIds.includes(querySettlementId)
      ? querySettlementId
      : settlements[0]?.id ?? null;

  const settlementOptions = settlements.map((s) => ({
    id: s.id,
    payoutDayKey: formatDayKeyString(s.payoutDayKey),
    periodStartDayKey: formatDayKeyString(s.periodStartDayKey),
    periodEndDayKey: formatDayKeyString(s.periodEndDayKey),
    label: `Payout ${formatDayKeyString(s.payoutDayKey)} (${formatDayKeyString(s.periodStartDayKey)} → ${formatDayKeyString(s.periodEndDayKey)})`,
  }));

  if (!selectedSettlementId) {
    return (
      <div className="relative min-h-screen bg-transparent">
        <div className="container mx-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <WarehouseHeader
              warehouses={warehouses.map((w) => ({ id: w.id, role: w.role, marketZone: w.marketZone }))}
              currentBuildingId={validBuildingId}
              activeTab="returns"
              title={
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  <RotateCcw className="h-7 w-7 text-muted-foreground" />
                  Warehouse Returns
                </h1>
              }
              description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
            />
            <Card className="border bg-card shadow-sm">
              <CardContent className="py-8 text-center text-muted-foreground">
                No settlements yet for this warehouse.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const [lines, trendLines] = await Promise.all([
    prisma.modaverseSettlementLine.findMany({
      where: { settlementId: selectedSettlementId },
      select: {
        productTemplateId: true,
        fulfilledQty: true,
        returnQty: true,
        grossRevenueUsd: true,
        returnDeductionUsd: true,
        netRevenueUsd: true,
      },
    }),
    prisma.modaverseSettlementLine.findMany({
      where: {
        settlementId: { in: settlements.slice(0, TREND_TAKE).map((s) => s.id) },
      },
      select: { settlementId: true, fulfilledQty: true, returnQty: true },
    }),
  ]);

  const productTemplateIds = [...new Set(lines.map((l) => l.productTemplateId))];
  const templates =
    productTemplateIds.length > 0
      ? await prisma.productTemplate.findMany({
          where: { id: { in: productTemplateIds } },
          select: { id: true, code: true, name: true, categoryL3Id: true },
        })
      : [];

  const l3Ids = [...new Set(templates.map((t) => t.categoryL3Id))];
  const nodesL3 =
    l3Ids.length > 0
      ? await prisma.productCategoryNode.findMany({
          where: { id: { in: l3Ids } },
          select: { id: true, parentId: true, level: true },
        })
      : [];
  const l2Ids = [...new Set(nodesL3.map((n) => n.parentId).filter(Boolean) as string[])];
  const nodesL2 =
    l2Ids.length > 0
      ? await prisma.productCategoryNode.findMany({
          where: { id: { in: l2Ids } },
          select: { id: true, name: true, code: true, level: true },
        })
      : [];

  const l3ToL2 = new Map<string, string>();
  for (const n of nodesL3) {
    if (n.parentId) l3ToL2.set(n.id, n.parentId);
  }
  const l2Meta = new Map(nodesL2.map((n) => [n.id, n]));

  const soldUnits = lines.reduce((s, l) => s + l.fulfilledQty, 0);
  const returnedUnits = lines.reduce((s, l) => s + l.returnQty, 0);
  const returnRateWeighted = soldUnits > 0 ? returnedUnits / soldUnits : 0;
  let grossRevenue = new Decimal(0);
  let returnDeduction = new Decimal(0);
  let netRevenue = new Decimal(0);
  for (const l of lines) {
    grossRevenue = grossRevenue.add(l.grossRevenueUsd);
    returnDeduction = returnDeduction.add(l.returnDeductionUsd);
    netRevenue = netRevenue.add(l.netRevenueUsd);
  }

  const templateById = new Map(templates.map((t) => [t.id, t]));

  const l2Agg = new Map<
    string,
    { totalSold: number; totalReturned: number; returnDeductionUsd: Decimal }
  >();
  for (const line of lines) {
    const template = templateById.get(line.productTemplateId);
    if (!template?.categoryL3Id) continue;
    const l2Id = l3ToL2.get(template.categoryL3Id);
    if (!l2Id) continue;
    const cur = l2Agg.get(l2Id) ?? {
      totalSold: 0,
      totalReturned: 0,
      returnDeductionUsd: new Decimal(0),
    };
    cur.totalSold += line.fulfilledQty;
    cur.totalReturned += line.returnQty;
    cur.returnDeductionUsd = cur.returnDeductionUsd.add(line.returnDeductionUsd);
    l2Agg.set(l2Id, cur);
  }

  const toL2Row = (
    l2Id: string,
    v: { totalSold: number; totalReturned: number; returnDeductionUsd: Decimal }
  ) => {
    const returnRate = v.totalSold > 0 ? v.totalReturned / v.totalSold : 0;
    return {
      categoryId: l2Id,
      categoryName: l2Meta.get(l2Id)?.name ?? l2Id,
      totalSold: v.totalSold,
      totalReturned: v.totalReturned,
      returnRate,
    };
  };

  const l2ByReturnUnits = Array.from(l2Agg.entries())
    .map(([l2Id, v]) => toL2Row(l2Id, v))
    .sort((a, b) => b.totalReturned - a.totalReturned)
    .slice(0, 5);

  const l2ByReturnRate = Array.from(l2Agg.entries())
    .map(([l2Id, v]) => toL2Row(l2Id, v))
    .filter((r) => r.totalSold >= MIN_SOLD_FOR_RATE)
    .sort((a, b) => b.returnRate - a.returnRate)
    .slice(0, 5);

  const topProducts = lines
    .map((line) => {
      const t = templateById.get(line.productTemplateId);
      return {
        code: t?.code ?? '',
        name: t?.name ?? '',
        soldUnits: line.fulfilledQty,
        returnUnits: line.returnQty,
        returnRate: line.fulfilledQty > 0 ? line.returnQty / line.fulfilledQty : 0,
        returnDeductionUsd: line.returnDeductionUsd,
      };
    })
    .sort((a, b) => b.returnUnits - a.returnUnits)
    .slice(0, TOP_PRODUCTS_LIMIT);

  const trendBySettlement = new Map<
    string,
    { soldUnits: number; returnUnits: number }
  >();
  for (const l of trendLines) {
    const cur = trendBySettlement.get(l.settlementId) ?? {
      soldUnits: 0,
      returnUnits: 0,
    };
    cur.soldUnits += l.fulfilledQty;
    cur.returnUnits += l.returnQty;
    trendBySettlement.set(l.settlementId, cur);
  }
  const trendData = settlements
    .slice(0, TREND_TAKE)
    .map((s) => {
      const v = trendBySettlement.get(s.id) ?? { soldUnits: 0, returnUnits: 0 };
      const rate = v.soldUnits > 0 ? v.returnUnits / v.soldUnits : 0;
      return {
        payoutDayKey: formatDayKeyString(s.payoutDayKey),
        soldUnits: v.soldUnits,
        returnUnits: v.returnUnits,
        returnRate: rate,
      };
    });

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6 min-w-full">
          <WarehouseHeader
            warehouses={warehouses.map((w) => ({ id: w.id, role: w.role, marketZone: w.marketZone }))}
            currentBuildingId={validBuildingId}
            activeTab="returns"
            title={
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                <RotateCcw className="h-7 w-7 text-muted-foreground" />
                Warehouse Returns
              </h1>
            }
            description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
          />

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Settlement period
            </label>
            <ReturnsPeriodSelect
              settlements={settlementOptions}
              currentSettlementId={selectedSettlementId}
              buildingId={validBuildingId}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 xl:grid-cols-6 xl:gap-4">
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0.5 pt-2 xl:pb-1 xl:pt-3">
                <CardTitle className="text-[11px] font-medium text-muted-foreground xl:text-xs">
                  Sold units
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2 xl:pb-4">
                <p className="text-[12px] font-semibold tabular-nums xl:text-2xl">{soldUnits}</p>
              </CardContent>
            </Card>
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0.5 pt-2 xl:pb-1 xl:pt-3">
                <CardTitle className="text-[11px] font-medium text-muted-foreground xl:text-xs">
                  Returned units
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2 xl:pb-4">
                <p className="text-[12px] font-semibold tabular-nums xl:text-2xl">{returnedUnits}</p>
              </CardContent>
            </Card>
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0.5 pt-2 xl:pb-1 xl:pt-3">
                <CardTitle className="text-[11px] font-medium text-muted-foreground xl:text-xs">
                  Return rate (weighted)
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2 xl:pb-4">
                <p className="text-[12px] font-semibold tabular-nums xl:text-2xl">{pct(returnRateWeighted)}</p>
              </CardContent>
            </Card>
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0.5 pt-2 xl:pb-1 xl:pt-3">
                <CardTitle className="text-[11px] font-medium text-muted-foreground xl:text-xs">
                  Gross revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2 xl:pb-4">
                <p className="text-[12px] font-semibold tabular-nums xl:text-xl">{formatUsd(grossRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0.5 pt-2 xl:pb-1 xl:pt-3">
                <CardTitle className="text-[11px] font-medium text-muted-foreground xl:text-xs">
                  Return deduction
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2 xl:pb-4">
                <p className="text-[12px] font-semibold tabular-nums xl:text-xl">{formatUsd(returnDeduction)}</p>
              </CardContent>
            </Card>
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0.5 pt-2 xl:pb-1 xl:pt-3">
                <CardTitle className="text-[11px] font-medium text-muted-foreground xl:text-xs">
                  Net revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2 xl:pb-4">
                <p className="text-[12px] font-semibold tabular-nums xl:text-xl">{formatUsd(netRevenue)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top by return units (L2)</CardTitle>
                <CardDescription>Category L2, by total returned units</CardDescription>
              </CardHeader>
              <CardContent>
                {l2ByReturnUnits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No category data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Sold</TableHead>
                          <TableHead className="text-right">Returned</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {l2ByReturnUnits.map((r) => (
                          <TableRow key={r.categoryId}>
                            <TableCell className="font-medium">{r.categoryName}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.totalSold}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.totalReturned}</TableCell>
                            <TableCell className="text-right tabular-nums">{pct(r.returnRate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top by return rate (L2)</CardTitle>
                <CardDescription>Min {MIN_SOLD_FOR_RATE} sold to reduce noise</CardDescription>
              </CardHeader>
              <CardContent>
                {l2ByReturnRate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No category data meeting threshold.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Sold</TableHead>
                          <TableHead className="text-right">Returned</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {l2ByReturnRate.map((r) => (
                          <TableRow key={r.categoryId}>
                            <TableCell className="font-medium">{r.categoryName}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.totalSold}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.totalReturned}</TableCell>
                            <TableCell className="text-right tabular-nums">{pct(r.returnRate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
            <Card
              className={`min-w-0 border bg-card shadow-sm ${trendData.length > 0 ? 'lg:col-span-7' : 'lg:col-span-10'}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top returned products</CardTitle>
                <CardDescription>By return units, limit {TOP_PRODUCTS_LIMIT}</CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No line data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Sold</TableHead>
                          <TableHead className="text-right">Returned</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Return deduction</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProducts.map((r, i) => (
                          <TableRow key={`${r.code}-${i}`}>
                            <TableCell className="font-medium">
                              {r.code} · {r.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{r.soldUnits}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.returnUnits}</TableCell>
                            <TableCell className="text-right tabular-nums">{pct(r.returnRate)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatUsd(r.returnDeductionUsd)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {trendData.length > 0 && (
              <Card className="min-w-0 border bg-card shadow-sm lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Return trend (last {TREND_TAKE} payouts)</CardTitle>
                  <CardDescription>Weighted return rate and returned units per period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {trendData.map((t) => (
                      <li
                        key={t.payoutDayKey}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 px-3 py-2"
                      >
                        <span className="font-medium tabular-nums text-muted-foreground">{t.payoutDayKey}</span>
                        <span className="tabular-nums">
                          Returned {t.returnUnits} / sold {t.soldUnits} · {pct(t.returnRate)} rate
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
