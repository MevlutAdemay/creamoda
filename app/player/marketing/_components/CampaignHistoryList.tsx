'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

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

const columns: { key: keyof CampaignHistoryRow; label: string; showFor: TabType[] }[] = [
  { key: 'packageKeySnapshot', label: 'Package', showFor: ['warehouse', 'category', 'product'] },
  { key: 'title', label: 'Title', showFor: ['warehouse', 'category', 'product'] },
  { key: 'categoryName', label: 'Category', showFor: ['category'] },
  { key: 'productName', label: 'Product', showFor: ['product'] },
  { key: 'startDayKey', label: 'Start Date', showFor: ['warehouse', 'category', 'product'] },
  { key: 'endDayKey', label: 'End Date', showFor: ['warehouse', 'category', 'product'] },
  { key: 'totalCost', label: 'Total Cost', showFor: ['warehouse', 'category', 'product'] },
  { key: 'status', label: 'Status', showFor: ['warehouse', 'category', 'product'] },
];

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

  const visibleColumns = columns.filter((c) => c.showFor.includes(tab));

  return (
    <div className="border rounded-md overflow-x-auto max-w-3xl">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {visibleColumns.map((col) => (
              <TableHead
                key={String(col.key)}
                className={cn(
                  col.key === 'totalCost' && 'text-right',
                  'select-none cursor-default'
                )}
              >
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length} className="text-muted-foreground text-sm select-none cursor-default">
                Loading…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length} className="text-muted-foreground text-sm select-none cursor-default">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {visibleColumns.map((col) => {
                  const isStatus = col.key === 'status';
                  const value = isStatus
                    ? displayStatus(row.status, row.endDayKey)
                    : getCellValue(row, col.key);
                  return (
                    <TableCell
                      key={String(col.key)}
                      className={cn(
                        col.key === 'totalCost' && 'text-right',
                        'select-none cursor-default'
                      )}
                    >
                      {value}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
