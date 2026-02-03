'use client';

import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Package } from 'lucide-react';

export type BacklogBreakdownRow = {
  dayKey: string;
  ordered: number;
  fulfilled: number;
  remaining: number;
};

type BacklogDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productCode: string;
  productName: string;
  thumbnailUrl: string | null;
  breakdown: BacklogBreakdownRow[];
};

function formatDayKey(dayKey: string): string {
  try {
    return new Date(dayKey).toISOString().split('T')[0];
  } catch {
    return dayKey;
  }
}

export function BacklogDrawer({
  open,
  onOpenChange,
  productCode,
  productName,
  thumbnailUrl,
  breakdown,
}: BacklogDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md p-4">
        <SheetHeader>
          <div className="flex gap-3">
            {thumbnailUrl ? (
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image
                  src={thumbnailUrl}
                  alt={productName}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">{productCode}</SheetTitle>
              <p className="truncate text-sm text-muted-foreground">{productName}</p>
            </div>
          </div>
        </SheetHeader>
        <p className="mt-3 text-xs text-muted-foreground">
          Fulfillment is FIFO by day.
        </p>
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
            Breakdown by day
          </p>
          <ul className="space-y-2">
            {breakdown.map((b) => (
              <li
                key={b.dayKey}
                className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 px-3 py-2 text-sm"
              >
                <span className="tabular-nums text-muted-foreground">
                  {formatDayKey(b.dayKey)}
                </span>
                <span className="tabular-nums">ordered {b.ordered}</span>
                <span className="tabular-nums">fulfilled {b.fulfilled}</span>
                <span className="font-medium tabular-nums">remaining {b.remaining}</span>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
