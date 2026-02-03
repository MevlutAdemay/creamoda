'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type BuildingSummaryRow = {
  buildingId: string;
  buildingName: string;
  buildingType: 'WAREHOUSE' | 'HQ';
  totalIn: number;
  totalOut: number;
  net: number;
};

type Props = { rows: BuildingSummaryRow[] };

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export function BuildingSummaryTable({ rows }: Props) {
  return (
    <div className="rounded-md border bg-card sm:mt-13">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-muted-foreground">Building</TableHead>
            <TableHead className="text-right text-muted-foreground">OUT</TableHead>
            <TableHead className="text-right text-muted-foreground">IN</TableHead>
            <TableHead className="text-right text-muted-foreground">Net</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">
                No buildings in scope.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.buildingId}>
               
                <TableCell className="text-muted-foreground text-xs">{row.buildingType}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">{formatUsd(row.totalOut)}</TableCell>
                <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">{formatUsd(row.totalIn)}</TableCell>
                <TableCell className={`text-right tabular-nums ${row.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatUsd(row.net)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
