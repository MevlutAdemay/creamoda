'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { SettlementRow } from './settlements-table';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: SettlementRow | null;
};

/** YYYY-MM-DD → DD/MM/YYYY */
function formatDate(dayKey: string): string {
  const [y, m, d] = dayKey.split('-');
  return d && m && y ? `${d}/${m}/${y}` : dayKey;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function SettlementDrawer({ open, onOpenChange, entry }: Props) {
  if (!entry) return null;

  const topLines = entry.topLines ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-4">
        <SheetHeader className="mt-10">
          <SheetTitle className="text-base">Settlement</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Period</span>
            <p className="font-mono text-xs">{formatDate(entry.periodStartDayKey)} – {formatDate(entry.periodEndDayKey)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Payout Day</span>
            <p className="font-mono text-xs">{formatDate(entry.payoutDayKey)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Warehouse</span>
            <p>{entry.warehouseName}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Card className="border bg-primary/30">
              <CardHeader className="pb-1 pt-2 px-3">
                <span className="text-[10px] font-medium text-muted-foreground">Gross</span>
              </CardHeader>
              <CardContent className="pb-2 pt-0 px-3">
                <p className="text-sm font-semibold tabular-nums">{formatUsd(entry.grossRevenueUsd)}</p>
              </CardContent>
            </Card>
            <Card className="border bg-primary/30">
              <CardHeader className="pb-1 pt-2 px-3">
                <span className="text-[10px] font-medium text-muted-foreground">Fees</span>
              </CardHeader>
              <CardContent className="pb-2 pt-0 px-3">
                <p className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{formatUsd(entry.totalFeesUsd)}</p>
              </CardContent>
            </Card>
            <Card className="border bg-primary/30">
              <CardHeader className="pb-1 pt-2 px-3">
                <span className="text-[10px] font-medium text-muted-foreground">Net</span>
              </CardHeader>
              <CardContent className="pb-2 pt-0 px-3">
                <p className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">{formatUsd(entry.netRevenueUsd)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
        {topLines.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Top 10 lines by gross</h4>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Product Code</TableHead>
                    <TableHead className="text-xs text-center">Gross</TableHead>
                    
                    <TableHead className="text-xs text-center">Sold</TableHead>
                    <TableHead className="text-xs text-center">Returns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLines.map((line, i) => (
                    <TableRow key={`${line.productTemplateId}-${i}`}>
                      <TableCell className="font-mono text-xs truncate max-w-[80px]" title={line.productCode ?? line.productTemplateId}>{line.productCode ?? line.productTemplateId}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatUsd(line.grossRevenueUsd)}</TableCell>          
                      <TableCell className="text-right text-xs tabular-nums">{line.fulfilledQty}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{line.returnQty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
