'use client';

import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type MonthlyFixExpenseRow = {
  label: string;
  amount: number;
};

type Props = { rows: MonthlyFixExpenseRow[] };

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function MonthlyFixExpensesTable({ rows }: Props) {
  const t = useTranslations('finance');
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="rounded-md border bg-card/50 sm:mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-muted-foreground">Item</TableHead>
            <TableHead className="text-right text-muted-foreground">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="h-20 text-center text-sm text-muted-foreground">
                No data.
              </TableCell>
            </TableRow>
          ) : (
            <>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="text-muted-foreground text-xs">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                    {formatUsd(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-border font-medium">
                <TableCell className="text-right text-foreground text-xs">{t('expenseTotal')}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                  {formatUsd(total)}
                </TableCell>
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
