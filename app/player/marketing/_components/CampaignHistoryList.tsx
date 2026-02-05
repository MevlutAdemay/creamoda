// app/player/marketing/_components/CampaignHistoryList.tsx

'use client';

import { cn } from '@/lib/utils';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';

export type CampaignHistoryRow = {
  id: string;
  packageKeySnapshot: string | null;
  title: string | null;
  startDayKey: string;
  endDayKey: string;
  totalCost: string | null;
  status: string;
  /** Category campaigns only */
  categoryName?: string | null;
  /** Product campaigns only */
  productName?: string | null;
};

type TabType = 'warehouse' | 'category' | 'product';

function formatDayKey(s: string): string {
  try {
    const d = new Date(s);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return s;
  }
}

function formatUsd(value: string | null): string {
  if (value == null) return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function getCellValue(row: CampaignHistoryRow, key: keyof CampaignHistoryRow): string {
  const v = row[key];
  if (key === 'startDayKey' || key === 'endDayKey') return formatDayKey(String(v ?? ''));
  if (key === 'totalCost') return formatUsd(row.totalCost ?? null);
  if (key === 'categoryName') return row.categoryName ?? '—';
  if (key === 'productName') return row.productName ?? '—';
  return (v as string) ?? '—';
}

type Props = {
  tab: TabType;
  rows: CampaignHistoryRow[];
  currentDayKey: string;
  loading?: boolean;
  emptyMessage?: string;
};

export function CampaignHistoryList({
  tab,
  rows,
  currentDayKey,
  loading,
  emptyMessage = 'No campaigns yet.',
}: Props) {
  const displayStatus = (status: string, endDayKey: string) => {
    const endStr = endDayKey.slice(0, 10);
    if (endStr < currentDayKey) return 'Completed';
    return status === 'ACTIVE' || status === 'SCHEDULED' ? 'Active' : status;
  };

  const getCardClasses = (row: CampaignHistoryRow) => {
    const status = displayStatus(row.status, row.endDayKey);
    if (status === 'Completed') {
      return 'bg-mv-danger/50 border-mv-danger text-mv-danger';
    }
    if (status === 'Active') {
      return 'bg-mv-success/50 border-mv-success text-mv-success';
    }
    return 'bg-muted/50';
  };

  return (
    <div className="flex flex-row flex-wrap gap-2 justify-between max-w-3xl space-y-3">
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 px-4 py-6">
          <ModaVerseLogoLoader size={40} className="text-primary" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        rows.map((row) => {
          const statusLabel = displayStatus(row.status, row.endDayKey);
          return (
            <div
              key={row.id}
              className={cn(
                'rounded-lg border p-3 text-sm w-[48%]',
                getCardClasses(row)
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="font-medium">{getCellValue(row, 'packageKeySnapshot')}</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-background/80">
                  {statusLabel}
                </span>
              </div>
              {(tab === 'category' && row.categoryName) || (tab === 'product' && row.productName) ? (
                <p className="mt-1 opacity-90">
                  {tab === 'category' ? (row.categoryName ?? '—') : (row.productName ?? '—')}
                </p>
              ) : null}
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 opacity-90">
                <span>Start</span>
                <span className="font-medium">{getCellValue(row, 'startDayKey')}</span>
                <span>End</span>
                <span className="font-medium">{getCellValue(row, 'endDayKey')}</span>
                <span>Cost</span>
                <span className="font-medium">{getCellValue(row, 'totalCost')}</span>
              </dl>
            </div>
          );
        })
      )}
    </div>
  );
}
