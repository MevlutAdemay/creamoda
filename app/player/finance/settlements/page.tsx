/**
 * Settlements Analytics – Server Component.
 * Data from ModaverseSettlement + ModaverseSettlementLine.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';
import { formatDayKeyString } from '@/lib/game/game-clock';
import type { SettlementsPageData } from './_lib/types';
import { SettlementsFilters } from './_components/settlements-filters';
import { SettlementsKpiCards } from './_components/settlements-kpi-cards';
import { NetRevenueTimelineChart } from './_components/net-revenue-timeline-chart';
import { FeesBreakdownChart } from './_components/fees-breakdown-chart';
import { SettlementsTable } from './_components/settlements-table';
import { SettlementsWarehouseSummaryTable } from './_components/settlements-warehouse-summary-table';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function buildingLabel(name: string | null, marketZone: string | null): string {
  return name?.trim() || marketZone || '—';
}

type PageProps = {
  searchParams: Promise<{ group?: string; warehouseBuildingId?: string }> | { group?: string; warehouseBuildingId?: string };
};

export default async function SettlementsPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const group = (params.group?.trim() || 'company') === 'warehouse' ? 'warehouse' : 'company';
  const warehouseBuildingId = params.warehouseBuildingId?.trim() || null;

  const buildings = await prisma.companyBuilding.findMany({
    where: { companyId: company.id, role: BuildingRole.WAREHOUSE },
    select: { id: true, name: true, marketZone: true },
    orderBy: { id: 'asc' },
  });

  const where: { companyId: string; warehouseBuildingId?: string } = {
    companyId: company.id,
  };
  if (group === 'warehouse' && warehouseBuildingId && buildings.some((b) => b.id === warehouseBuildingId)) {
    where.warehouseBuildingId = warehouseBuildingId;
  }

  const settlementsWithLines = await prisma.modaverseSettlement.findMany({
    where,
    include: {
      lines: {
        include: {
          productTemplate: { select: { code: true } },
        },
      },
      warehouse: {
        select: { id: true, name: true, marketZone: true },
      },
    },
    orderBy: [{ payoutDayKey: 'desc' }, { periodStartDayKey: 'desc' }],
  });

  const warehouseOptions = buildings.map((b) => ({
    value: b.id,
    label: buildingLabel(b.name, b.marketZone),
    buildingId: b.id,
  }));

  let grossRevenueUsd = 0;
  let commissionFeeUsd = 0;
  let logisticsFeeUsd = 0;
  let returnDeductionUsd = 0;
  let netRevenueUsd = 0;
  let totalFulfilledQty = 0;
  let totalReturnQty = 0;
  const byBucket = new Map<string, { gross: number; commission: number; logistics: number; returnDed: number; net: number }>();
  const byWarehouse = new Map<string, { gross: number; commission: number; logistics: number; returnDed: number; net: number; fulfilled: number; returns: number }>();

  const bucketKey = (d: Date) => formatDayKeyString(d).slice(0, 7);

  for (const s of settlementsWithLines) {
    const payoutKey = bucketKey(s.payoutDayKey);
    let setGross = 0;
    let setCommission = 0;
    let setLogistics = 0;
    let setReturnDed = 0;
    let setNet = 0;
    let setFulfilled = 0;
    let setReturns = 0;
    for (const line of s.lines) {
      const gross = Number(line.grossRevenueUsd);
      const comm = Number(line.commissionFeeUsd);
      const log = Number(line.logisticsFeeUsd);
      const ret = Number(line.returnDeductionUsd);
      const net = Number(line.netRevenueUsd);
      setGross += gross;
      setCommission += comm;
      setLogistics += log;
      setReturnDed += ret;
      setNet += net;
      setFulfilled += line.fulfilledQty;
      setReturns += line.returnQty;
    }
    grossRevenueUsd += setGross;
    commissionFeeUsd += setCommission;
    logisticsFeeUsd += setLogistics;
    returnDeductionUsd += setReturnDed;
    netRevenueUsd += setNet;
    totalFulfilledQty += setFulfilled;
    totalReturnQty += setReturns;

    const b = byBucket.get(payoutKey) ?? { gross: 0, commission: 0, logistics: 0, returnDed: 0, net: 0 };
    b.gross += setGross;
    b.commission += setCommission;
    b.logistics += setLogistics;
    b.returnDed += setReturnDed;
    b.net += setNet;
    byBucket.set(payoutKey, b);

    const wid = s.warehouseBuildingId;
    const w = byWarehouse.get(wid) ?? { gross: 0, commission: 0, logistics: 0, returnDed: 0, net: 0, fulfilled: 0, returns: 0 };
    w.gross += setGross;
    w.commission += setCommission;
    w.logistics += setLogistics;
    w.returnDed += setReturnDed;
    w.net += setNet;
    w.fulfilled += setFulfilled;
    w.returns += setReturns;
    byWarehouse.set(wid, w);
  }

  const returnRate = totalFulfilledQty > 0 ? totalReturnQty / totalFulfilledQty : null;
  const sortedBuckets = Array.from(byBucket.keys()).sort();
  const timeline = sortedBuckets.map((bucket) => {
    const b = byBucket.get(bucket)!;
    return { bucket, netRevenueUsd: b.net, grossRevenueUsd: b.gross };
  });
  const feesByBucket = sortedBuckets.map((bucket) => {
    const b = byBucket.get(bucket)!;
    return {
      bucket,
      commissionFeeUsd: b.commission,
      logisticsFeeUsd: b.logistics,
      returnDeductionUsd: b.returnDed,
    };
  });

  const settlementRows = settlementsWithLines.map((s) => {
    let gross = 0;
    let commission = 0;
    let logistics = 0;
    let returnDed = 0;
    let net = 0;
    const lineList = s.lines.map((l) => {
      const g = Number(l.grossRevenueUsd);
      const c = Number(l.commissionFeeUsd);
      const lg = Number(l.logisticsFeeUsd);
      const r = Number(l.returnDeductionUsd);
      const n = Number(l.netRevenueUsd);
      gross += g;
      commission += c;
      logistics += lg;
      returnDed += r;
      net += n;
      const productCode = l.productTemplate?.code ?? l.productTemplateId;
      return {
        productTemplateId: l.productTemplateId,
        productCode,
        grossRevenueUsd: g,
        commissionFeeUsd: c,
        logisticsFeeUsd: lg,
        returnDeductionUsd: r,
        netRevenueUsd: n,
        fulfilledQty: l.fulfilledQty,
        returnQty: l.returnQty,
      };
    });
    const topLines = lineList
      .sort((a, b) => b.grossRevenueUsd - a.grossRevenueUsd)
      .slice(0, 10);
    const warehouseName = s.warehouse ? buildingLabel(s.warehouse.name, s.warehouse.marketZone) : s.warehouseBuildingId;
    return {
      id: s.id,
      periodStartDayKey: formatDayKeyString(s.periodStartDayKey),
      periodEndDayKey: formatDayKeyString(s.periodEndDayKey),
      payoutDayKey: formatDayKeyString(s.payoutDayKey),
      warehouseName,
      warehouseBuildingId: s.warehouseBuildingId,
      grossRevenueUsd: gross,
      totalFeesUsd: commission + logistics + returnDed,
      netRevenueUsd: net,
      topLines,
    };
  });

  const warehouseSummary = Array.from(byWarehouse.entries()).map(([warehouseBuildingId, w]) => {
    const b = buildings.find((x) => x.id === warehouseBuildingId);
    return {
      warehouseBuildingId,
      warehouseName: b ? buildingLabel(b.name, b.marketZone) : warehouseBuildingId,
      grossRevenueUsd: w.gross,
      commissionFeeUsd: w.commission,
      logisticsFeeUsd: w.logistics,
      returnDeductionUsd: w.returnDed,
      netRevenueUsd: w.net,
      returnRate: w.fulfilled > 0 ? w.returns / w.fulfilled : null,
    };
  });

  const data: SettlementsPageData = {
    group,
    warehouseBuildingId,
    totals: {
      grossRevenueUsd,
      commissionFeeUsd,
      logisticsFeeUsd,
      returnDeductionUsd,
      netRevenueUsd,
      returnRate,
    },
    timeline,
    feesByBucket,
    settlementRows,
    warehouseSummary,
    warehouseOptions,
  };

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6 min-w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                <FileText className="h-7 w-7 text-muted-foreground" />
                Settlements
              </h1>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/player/finance">← Finance</Link>
              </Button>
            </div>
            <SettlementsFilters
              group={group}
              warehouseBuildingId={warehouseBuildingId}
              warehouseOptions={data.warehouseOptions}
            />
          </div>

          <SettlementsKpiCards totals={data.totals} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Net Revenue Timeline</CardTitle>
                <CardDescription>Net and gross revenue by period</CardDescription>
              </CardHeader>
              <CardContent>
                <NetRevenueTimelineChart data={data.timeline} />
              </CardContent>
            </Card>
            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Fees Breakdown</CardTitle>
                <CardDescription>Commission, logistics, returns by period</CardDescription>
              </CardHeader>
              <CardContent>
                <FeesBreakdownChart data={data.feesByBucket} />
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Settlements</h2>
            <SettlementsTable rows={data.settlementRows} />
          </div>

          {(data.group === 'warehouse' || data.warehouseSummary.length > 1) && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Warehouse Summary</h2>
              <SettlementsWarehouseSummaryTable rows={data.warehouseSummary} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
