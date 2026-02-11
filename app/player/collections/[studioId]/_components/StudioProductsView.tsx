'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CollectionProductCard, type CollectionProductCardProps } from './CollectionProductCard';

export type CategoryGroup = {
  value: string;
  label: string;
  count: number;
};

type StudioProductsViewProps = {
  products: (CollectionProductCardProps & { categoryL1Name: string | null })[];
  groups: CategoryGroup[];
};

export function StudioProductsView({ products, groups }: StudioProductsViewProps) {
  const [selected, setSelected] = useState<string>(groups[0]?.value ?? 'ALL');

  const filtered = useMemo(() => {
    if (selected === 'ALL') return products;
    return products.filter((p) => (p.categoryL1Name ?? 'OTHER') === selected);
  }, [products, selected]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {groups.map((group) => {
          const isActive = selected === group.value;
          return (
            <Button
              key={group.value}
              variant={isActive ? 'default' : 'outline'}
              size="default"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelected(group.value)}
            >
              <span>{group.label}</span>
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className={cn(
                  'rounded-full text-xs',
                  isActive && 'bg-primary-foreground/20 text-primary-foreground border-0'
                )}
              >
                {group.count}
              </Badge>
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5 gap-2">
        {filtered.map((p) => (
          <CollectionProductCard key={p.templateId} {...p} />
        ))}
      </div>
    </div>
  );
}
