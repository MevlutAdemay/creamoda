// creamoda/app/player/finance/settlements/_components/settlements-table.tsx

'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SettlementDrawer } from './settlement-drawer';

export type SettlementRow = {
  id: string;
  periodStartDayKey: string;
  periodEndDayKey: string;
  payoutDayKey: string;
  warehouseName: string;
  warehouseBuildingId: string;
  grossRevenueUsd: number;
  totalFeesUsd: number;
  netRevenueUsd: number;
  topLines: {
    productTemplateId: string;
    productCode: string;
    grossRevenueUsd: number;
    commissionFeeUsd: number;
    logisticsFeeUsd: number;
    returnDeductionUsd: number;
    netRevenueUsd: number;
    fulfilledQty: number;
    returnQty: number;
  }[];
};

type Props = { rows: SettlementRow[] };

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const;

/** YYYY-MM-DD → DD/MM/YYYY */
function formatDate(dayKey: string): string {
  const [y, m, d] = dayKey.split('-');
  return d && m && y ? `${d}/${m}/${y}` : dayKey;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export function SettlementsTable({ rows }: Props) {
  const [selected, setSelected] = useState<SettlementRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const openRow = (row: SettlementRow) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const pageIndex = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((pageIndex - 1) * rowsPerPage, pageIndex * rowsPerPage),
    [rows, pageIndex, rowsPerPage]
  );

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(v) => {
                setRowsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[72px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>rows</span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>
                Page {pageIndex} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pageIndex <= 1}
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageIndex >= totalPages}
              >
                ›
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">Payout Day</TableHead>
                <TableHead className="text-muted-foreground">Period</TableHead>
                <TableHead className="text-muted-foreground">Warehouse</TableHead>
                <TableHead className="text-right text-muted-foreground">Gross</TableHead>
                <TableHead className="text-right text-muted-foreground">Fees</TableHead>
                <TableHead className="text-right text-muted-foreground">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No settlements in the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openRow(row)}
                >
                  <TableCell className="font-mono text-sm">{formatDate(row.payoutDayKey)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatDate(row.periodStartDayKey)} – {formatDate(row.periodEndDayKey)}
                  </TableCell>
                  <TableCell className="truncate max-w-[140px]" title={row.warehouseName}>{row.warehouseName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(row.grossRevenueUsd)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">{formatUsd(row.totalFeesUsd)}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">{formatUsd(row.netRevenueUsd)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
      <SettlementDrawer open={drawerOpen} onOpenChange={setDrawerOpen} entry={selected} />
    </>
  );
}
