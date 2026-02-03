'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BacklogDrawer } from './BacklogDrawer';
import type { BacklogProductItem } from './types';

type BacklogProductListProps = {
  items: BacklogProductItem[];
};

function formatDayKey(dayKey: string): string {
  try {
    return new Date(dayKey).toISOString().split('T')[0];
  } catch {
    return dayKey;
  }
}

export function BacklogProductList({ items }: BacklogProductListProps) {
  const [selected, setSelected] = useState<BacklogProductItem | null>(null);

  const top10 = items.slice(0, 10);

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-foreground">
        Backlog by product (top 10)
      </h2>
      {top10.length === 0 ? (
        <Card className="border bg-card shadow-sm">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No backlog.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {top10.map((row) => (
            <li key={row.productTemplateId}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-sm',
                  'transition-colors hover:bg-muted/50'
                )}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {row.thumbnailUrl ? (
                    <Image
                      src={row.thumbnailUrl}
                      alt={row.productName}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.productCode} · {row.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.backlogUnits} units · oldest {formatDayKey(row.oldestDayKey)}
                  </p>
                </div>
                <Badge variant="outline" className="tabular-nums">
                  {row.backlogUnits}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <BacklogDrawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        productCode={selected?.productCode ?? ''}
        productName={selected?.productName ?? ''}
        thumbnailUrl={selected?.thumbnailUrl ?? null}
        breakdown={
          selected?.breakdown.map((b) => ({
            dayKey: b.dayKey,
            ordered: b.ordered,
            fulfilled: b.fulfilled,
            remaining: b.remaining,
          })) ?? []
        }
      />
    </div>
  );
}
