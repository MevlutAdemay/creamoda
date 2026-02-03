// creamoda/app/player/finance/settlements/_components/settlements-kpi-cards.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Percent } from 'lucide-react';

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPercent(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(n);
}

type Totals = {
  grossRevenueUsd: number;
  commissionFeeUsd: number;
  logisticsFeeUsd: number;
  returnDeductionUsd: number;
  netRevenueUsd: number;
  returnRate: number | null;
};

type Props = { totals: Totals };

export function SettlementsKpiCards({ totals }: Props) {
  const totalFeesUsd = totals.commissionFeeUsd + totals.logisticsFeeUsd + totals.returnDeductionUsd;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            Gross Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">{formatUsd(totals.grossRevenueUsd)}</p>
        </CardContent>
      </Card>
      {/* Mobilde tek Fees kartı (üç giderin toplamı) */}
      <Card className="border bg-card shadow-sm md:hidden">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">{formatUsd(totalFeesUsd)}</p>
        </CardContent>
      </Card>
      {/* Masaüstünde ayrı ayrı: Commission, Logistics, Return Deductions */}
      <Card className="border bg-card shadow-sm hidden md:block">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Commission Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">{formatUsd(totals.commissionFeeUsd)}</p>
        </CardContent>
      </Card>
      <Card className="border bg-card shadow-sm hidden md:block">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Logistics Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">{formatUsd(totals.logisticsFeeUsd)}</p>
        </CardContent>
      </Card>
      <Card className="border bg-card shadow-sm hidden md:block">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Return Deductions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">{formatUsd(totals.returnDeductionUsd)}</p>
        </CardContent>
      </Card>
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            Net Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">{formatUsd(totals.netRevenueUsd)}</p>
        </CardContent>
      </Card>
      {/* Return Rate: mobilde gizli, md ve üzeri görünsün */}
      <Card className="border bg-card shadow-sm hidden md:block">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Percent className="h-3.5 w-3.5" />
            Return Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold tabular-nums">
            {totals.returnRate != null ? formatPercent(totals.returnRate) : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
