/**
 * Three column product lists: Today Orders, Today Shipped, Backlog.
 * Server-rendered; no interactivity.
 */

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

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

function ProductListCard({
  title,
  rows,
}: {
  title: string;
  rows: LogisticsProductListRow[];
}) {
  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.productTemplateId}
                className="flex items-center gap-3 rounded-md border bg-muted/20 px-2 py-1.5"
              >
                <div className="relative h-[52px] w-10 shrink-0 overflow-hidden rounded bg-muted">
                  {row.imageUrl ? (
                    <Image
                      src={row.imageUrl}
                      alt={row.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {row.code}
                  </p>
                  <p className="truncate text-xs text-foreground" title={row.name}>
                    {row.name}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                  {row.qty}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function LogisticsProductLists({
  todayOrders,
  todayShipped,
  backlog,
}: LogisticsProductListsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ProductListCard title="Bugün Gelen Siparişler" rows={todayOrders} />
      <ProductListCard title="Bugün Teslim Edilenler" rows={todayShipped} />
      <ProductListCard title="Backlog" rows={backlog} />
    </div>
  );
}
