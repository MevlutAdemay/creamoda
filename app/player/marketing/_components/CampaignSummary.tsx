'use client';

import { cn } from '@/lib/utils';

export type SummaryTarget = {
  type: 'warehouse' | 'category' | 'product';
  warehouseName?: string;
  categoryName?: string;
  productName?: string;
};
export type SummaryPackage = {
  name: string;
  key: string;
  boostPct: number;
  durationDays: number;
  awarenessGainDec: string;
};
export type SummaryDates = {
  startDayKey: string;
  endDayKey: string;
};

type Props = {
  target: SummaryTarget;
  affectedSkus: number;
  pkg: SummaryPackage;
  dates: SummaryDates;
  estimatedTotalCost: string;
  formatUsd: (v: string) => string;
  formatDayKey: (s: string) => string;
};

function targetLabel(target: SummaryTarget): string {
  if (target.type === 'warehouse') return target.warehouseName ?? 'Warehouse';
  if (target.type === 'category') return target.categoryName ?? 'Category';
  return target.productName ?? 'Product';
}

export function CampaignSummary({
  target,
  affectedSkus,
  pkg,
  dates,
  estimatedTotalCost,
  formatUsd,
  formatDayKey,
}: Props) {
  return (
    <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
      <h4 className="font-medium select-none cursor-default">Summary</h4>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground select-none cursor-default">Target</dt>
          <dd className="select-none cursor-default">{targetLabel(target)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground select-none cursor-default">Affected SKUs</dt>
          <dd className="select-none cursor-default">{affectedSkus}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground select-none cursor-default">Package</dt>
          <dd className="select-none cursor-default">{pkg.name} ({pkg.key})</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground select-none cursor-default">Boost</dt>
          <dd className="select-none cursor-default">+{pkg.boostPct}%</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground select-none cursor-default">Duration</dt>
          <dd className="select-none cursor-default">{pkg.durationDays} days</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground select-none cursor-default">Permanent awareness</dt>
          <dd className="select-none cursor-default">+{pkg.awarenessGainDec}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground select-none cursor-default">Start date</dt>
          <dd className="select-none cursor-default">{formatDayKey(dates.startDayKey)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground select-none cursor-default">End date</dt>
          <dd className="select-none cursor-default">{formatDayKey(dates.endDayKey)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <dt className="text-muted-foreground select-none cursor-default">Estimated total cost</dt>
          <dd className="select-none cursor-default">{formatUsd(estimatedTotalCost)}</dd>
        </div>
      </dl>
    </div>
  );
}
