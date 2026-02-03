'use client';

import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { LedgerRow } from './ledger-table';

/** CTA route for refType or category (only known ones; others no link). */
const REF_TYPE_ROUTES: Record<string, string> = {
  PART_TIME_BACKLOG_CLEAR: '/player/warehouse/logistics',
  PART_TIME: '/player/warehouse/logistics',
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerRow | null;
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function LedgerDrawer({ open, onOpenChange, entry }: Props) {
  if (!entry) return null;

  const ctaHref = (entry.refType && REF_TYPE_ROUTES[entry.refType]) || (entry.category === 'PART_TIME' ? REF_TYPE_ROUTES['PART_TIME'] : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle className="text-base">Ledger Entry</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Date</span>
            <p className="font-mono">{entry.dayKey}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Category</span>
            <p>{entry.category}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Direction</span>
            <p className={entry.direction === 'IN' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{entry.direction}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Amount</span>
            <p className="font-semibold tabular-nums">{formatUsd(entry.amount)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Scope</span>
            <p>{entry.scopeType} {entry.scopeId ? `– ${entry.scopeLabel}` : ''}</p>
          </div>
          {entry.refType && (
            <div>
              <span className="text-muted-foreground">Ref type</span>
              <p className="font-mono text-xs">{entry.refType}</p>
            </div>
          )}
          {entry.note && (
            <div>
              <span className="text-muted-foreground">Note</span>
              <p className="text-md font-medium text-primary whitespace-pre-wrap">{entry.note}</p>
            </div>
          )}
          {ctaHref && (
            <div className="pt-4">
              <Button asChild size="sm">
                <Link href={ctaHref} onClick={() => onOpenChange(false)}>
                  Go to source page
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
