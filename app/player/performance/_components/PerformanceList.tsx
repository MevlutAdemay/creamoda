// app/player/performance/_components/PerformanceList.tsx

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type PerformanceListRow,
  type PerformanceSortKey,
  type PerformanceSortDir,
  sortPerformanceRows,
} from '../_lib/product-performance';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const;

/** Band evaluation tone → CSS class (badge and text use same criterion) */
function getSalesEvalClass(tone: 'danger' | 'warning' | 'neutral' | 'success'): string {
  return tone === 'danger' ? 'sales-eval-danger' : tone === 'warning' ? 'sales-eval-warning' : tone === 'success' ? 'sales-eval-success' : 'sales-eval-neutral';
}

function SortIcon({
  sortKey,
  currentKey,
  dir,
}: {
  sortKey: PerformanceSortKey;
  currentKey: PerformanceSortKey;
  dir: PerformanceSortDir;
}) {
  if (currentKey !== sortKey) return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />;
  return dir === 'asc' ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />;
}

type PerformanceListProps = {
  rows: PerformanceListRow[];
  warehouseId: string | null;
};

const DEFAULT_DIR: Record<PerformanceSortKey, PerformanceSortDir> = {
  performance: 'desc',
  name: 'asc',
  avgDailySales: 'desc',
  profitability: 'desc',
  stockRisk: 'asc',
  seasonFit: 'desc',
  expectedSoldSeason: 'desc',
  expectedLeftoverSeason: 'desc',
};

export function PerformanceList({ rows, warehouseId }: PerformanceListProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<PerformanceSortKey>('performance');
  const [sortDir, setSortDir] = useState<PerformanceSortDir>('desc');
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const query = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '';

  const toggleSort = (key: PerformanceSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
    setCurrentPage(1);
  };

  const sortedRows = useMemo(
    () => sortPerformanceRows(rows, sortKey, sortDir),
    [rows, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const pageIndex = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(
    () => sortedRows.slice((pageIndex - 1) * rowsPerPage, pageIndex * rowsPerPage),
    [sortedRows, pageIndex, rowsPerPage]
  );

  const goToDetail = (playerProductId: string) => {
    router.push(`/player/performance/${playerProductId}${query}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {sortedRows.length} product{sortedRows.length !== 1 ? 's' : ''} in this warehouse
        </p>
       
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 max-w-6xl">
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
            <div className="flex items-center gap-1 text-sm text-foreground">
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

        <div className="rounded-md border bg-card/50 max-w-6xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-14">Product</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center font-medium hover:opacity-80"
                    onClick={() => toggleSort('name')}
                  >
                    Name
                    <SortIcon sortKey="name" currentKey={sortKey} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="flex items-center justify-end font-medium w-full hover:opacity-80"
                    onClick={() => toggleSort('expectedSoldSeason')}
                  >
                    Exp. Sold
                    <SortIcon sortKey="expectedSoldSeason" currentKey={sortKey} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="flex items-center justify-end font-medium w-full hover:opacity-80"
                    onClick={() => toggleSort('expectedLeftoverSeason')}
                  >
                    Exp. Leftover
                    <SortIcon sortKey="expectedLeftoverSeason" currentKey={sortKey} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="w-28">
                  <button
                    type="button"
                    className="flex items-center font-medium hover:opacity-80"
                    onClick={() => toggleSort('performance')}
                  >
                    Performance
                    <SortIcon sortKey="performance" currentKey={sortKey} dir={sortDir} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No listed products in this warehouse.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <TableRow
                    key={row.playerProductId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => goToDetail(row.playerProductId)}
                  >
                    <TableCell>
                      <div className="w-12 h-16 relative rounded overflow-hidden bg-muted shrink-0">
                        {row.productImageUrl ? (
                          <Image
                            src={row.productImageUrl}
                            alt={row.productImageAlt ?? row.productName}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            —
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {row.expectedSoldSeason != null ? `~${Math.round(row.expectedSoldSeason)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {row.expectedLeftoverSeason != null ? `~${Math.round(row.expectedLeftoverSeason)}` : '—'}
                    </TableCell>
                   
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-flex w-fit rounded-md px-2 py-1 text-xs font-semibold ${getSalesEvalClass(row.salesBandEvaluation.tone)}`}
                        >
                          {row.salesBandEvaluation.label}
                        </span>
                        <p className={`rounded-md px-2 py-1 text-xs font-medium ${getSalesEvalClass(row.salesBandEvaluation.tone)}`}>
                          %{row.salesBandEvaluation.pct} — {row.salesBandEvaluation.note}
                        </p>
                      </div>
                    </TableCell>
                   
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
