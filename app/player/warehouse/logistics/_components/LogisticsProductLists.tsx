// creamoda/app/player/warehouse/logistics/_components/LogisticsProductLists.tsx

'use client';

/**
 * Three product lists as tables: Today Orders, Today Shipped, Backlog.
 * Same table UX as ledger-table: Show rows, pagination, sortable columns.
 */

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
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
import { Package, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export type LogisticsProductListRow = {
  productTemplateId: string;
  code: string;
  name: string;
  imageUrl?: string | null;
  qty: number;
};

type LogisticsProductListsProps = {
  todayOrders: LogisticsProductListRow[];
  todayShipped: LogisticsProductListRow[];
  backlog: LogisticsProductListRow[];
};

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const;
type SortKey = 'code' | 'name' | 'qty';
type SortDir = 'asc' | 'desc';

function SortIcon({
  sortKey,
  currentKey,
  dir,
}: {
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
}) {
  if (currentKey !== sortKey) return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />;
  return dir === 'asc' ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />;
}

function ProductListTable({ title, rows }: { title: string; rows: LogisticsProductListRow[] }) {
  const t = useTranslations('warehouse.logistics');
  const [sortKey, setSortKey] = useState<SortKey>('qty');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'qty' ? 'desc' : 'asc');
    }
  };

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'code':
          cmp = a.code.localeCompare(b.code);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'qty':
          cmp = a.qty - b.qty;
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

  return (
    <div className="space-y-2">
      <h3 className="text-base font-medium text-foreground">{title}</h3>
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
            <SelectTrigger className="h-8 w-[72px]">
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

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12"> </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center font-medium"
                  onClick={() => toggleSort('code')}
                >
                  {t('code')}
                  <SortIcon sortKey="code" currentKey={sortKey} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center font-medium"
                  onClick={() => toggleSort('name')}
                >
                  {t('name')}
                  <SortIcon sortKey="name" currentKey={sortKey} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="flex w-full items-center justify-end font-medium"
                  onClick={() => toggleSort('qty')}
                >
                  {t('qty')}
                  <SortIcon sortKey="qty" currentKey={sortKey} dir={sortDir} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => (
                <TableRow key={row.productTemplateId} className="hover:bg-muted/50">
                  <TableCell className="w-12 p-2">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-muted">
                      {row.imageUrl ? (
                        <Image
                          src={row.imageUrl}
                          alt={row.name}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.code}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={row.name}>
                    {row.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.qty}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function LogisticsProductLists({
  todayOrders,
  todayShipped,
  backlog,
}: LogisticsProductListsProps) {
  const t = useTranslations('warehouse.logistics');
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ProductListTable title={t('todayOrders')} rows={todayOrders} />
      <ProductListTable title={t('todayShipped')} rows={todayShipped} />
      <ProductListTable title={t('backlog')} rows={backlog} />
    </div>
  );
}
