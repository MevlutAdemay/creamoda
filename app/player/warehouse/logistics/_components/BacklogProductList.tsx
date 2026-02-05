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
