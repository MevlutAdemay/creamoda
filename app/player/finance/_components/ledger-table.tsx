// creamoda/app/player/finance/_components/ledger-table.tsx

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
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
import { LedgerDrawer } from './ledger-drawer';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export type LedgerRow = {
  id: string;
  dayKey: string;
  category: string;
  direction: 'IN' | 'OUT';
  amount: number;
  scopeLabel: string;
  refType?: string | null;
  note?: string | null;
  scopeType: string;
  scopeId?: string | null;
  idempotencyKey?: string | null;
  refId?: string | null;
};

type CurrentParams = { range: string; scope: string; scopeId: string | null };

type Props = {
  rows: LedgerRow[];
  hasMore?: boolean;
  nextCursor?: string | null;
  currentParams?: CurrentParams;
};

type SortKey = 'dayKey' | 'category' | 'direction' | 'amount' | 'refType';
type SortDir = 'asc' | 'desc';

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const;

function SortIcon({ sortKey, currentKey, dir }: { sortKey: SortKey; currentKey: SortKey; dir: SortDir }) {
  if (currentKey !== sortKey) return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />;
  return dir === 'asc' ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />;
}

export function LedgerTable({ rows, hasMore = false, nextCursor = null, currentParams }: Props) {
  const t = useTranslations('finance.table');
  const locale = useLocale();
  const [selected, setSelected] = useState<LedgerRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('dayKey');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const openRow = (row: LedgerRow) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'dayKey' || key === 'amount' ? 'desc' : 'asc');
    }
  };

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'dayKey':
          cmp = a.dayKey.localeCompare(b.dayKey);
          break;
        case 'category':
          cmp = a.category.localeCompare(b.category);
          break;
        case 'direction':
          cmp = a.direction.localeCompare(b.direction);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        case 'refType':
          cmp = (a.refType ?? '').localeCompare(b.refType ?? '');
          break;
        default:
          cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const pageIndex = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(
    () => sortedRows.slice((pageIndex - 1) * rowsPerPage, pageIndex * rowsPerPage),
    [sortedRows, pageIndex, rowsPerPage]
  );

  const loadMoreHref =
    currentParams && nextCursor
      ? `/player/finance?range=${currentParams.range}&scope=${currentParams.scope}${currentParams.scopeId ? `&scopeId=${currentParams.scopeId}` : ''}&cursor=${encodeURIComponent(nextCursor)}`
      : null;

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('show')}</span>
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
            <span>{t('rows')}</span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>
                {t('page', { current: pageIndex, total: totalPages })}
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

        <div className="rounded-md border bg-card/50">
          <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>
                    <button
                      type="button"
                      className="flex items-center font-medium"
                      onClick={() => toggleSort('dayKey')}
                    >
                      {t('date')}
                      <SortIcon sortKey="dayKey" currentKey={sortKey} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="flex items-center font-medium"
                      onClick={() => toggleSort('category')}
                    >
                      {t('category')}
                      <SortIcon sortKey="category" currentKey={sortKey} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="flex items-center font-medium"
                      onClick={() => toggleSort('direction')}
                    >
                      {t('direction')}
                      <SortIcon sortKey="direction" currentKey={sortKey} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      className="flex items-center justify-end font-medium w-full"
                      onClick={() => toggleSort('amount')}
                    >
                      {t('amount')}
                      <SortIcon sortKey="amount" currentKey={sortKey} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="flex items-center font-medium"
                      onClick={() => toggleSort('refType')}
                    >
                      {t('refType')}
                      <SortIcon sortKey="refType" currentKey={sortKey} dir={sortDir} />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openRow(row)}
                    >
                      <TableCell className="font-mono text-xs">{row.dayKey}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>
                        <span className={row.direction === 'IN' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {row.direction}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.amount, locale)}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-muted-foreground" title={row.refType ?? ''}>
                        {row.refType ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </div>
      </div>

      {hasMore && loadMoreHref && (
        <div className="mt-2 flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href={loadMoreHref}>{t('loadMore')}</Link>
          </Button>
        </div>
      )}

      <LedgerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        entry={selected}
      />
    </>
  );
}
