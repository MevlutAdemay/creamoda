'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type WarehouseSummaryRow = {
  warehouseBuildingId: string;
  warehouseName: string;
  grossRevenueUsd: number;
  commissionFeeUsd: number;
  logisticsFeeUsd: number;
  returnDeductionUsd: number;
  netRevenueUsd: number;
  returnRate: number | null;
};

type Props = { rows: WarehouseSummaryRow[] };

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatPercent(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(n);
}

export function SettlementsWarehouseSummaryTable({ rows }: Props) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-muted-foreground">Warehouse</TableHead>
            <TableHead className="text-right text-muted-foreground">Gross</TableHead>
            <TableHead className="text-right text-muted-foreground">Commission</TableHead>
            <TableHead className="text-right text-muted-foreground">Logistics</TableHead>
            <TableHead className="text-right text-muted-foreground">Returns</TableHead>
            <TableHead className="text-right text-muted-foreground">Net</TableHead>
            <TableHead className="text-right text-muted-foreground">Return Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-20 text-center text-sm text-muted-foreground">
                No warehouse data.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.warehouseBuildingId}>
                <TableCell className="font-medium truncate max-w-[140px]" title={row.warehouseName}>{row.warehouseName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(row.grossRevenueUsd)}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">{formatUsd(row.commissionFeeUsd)}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">{formatUsd(row.logisticsFeeUsd)}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">{formatUsd(row.returnDeductionUsd)}</TableCell>
                <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">{formatUsd(row.netRevenueUsd)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{row.returnRate != null ? formatPercent(row.returnRate) : '—'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
