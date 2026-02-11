// app/player/collections/_components/CollectionsGroupNavigator.tsx

'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { CollectionsGroup } from '../_lib/types';
import { Button } from '@/components/ui/button';

type CollectionsGroupNavigatorProps = {
  groups: CollectionsGroup[];
  value: string;
  onValueChange: (value: string) => void;
};

export function CollectionsGroupNavigator({
  groups,
  value,
  onValueChange,
}: CollectionsGroupNavigatorProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {groups.map((group) => {
        const isActive = value === group.value;
        return (
          <Button
            key={group.value}
            variant={isActive ? 'default' : 'outline'}
            size="default"
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange(group.value)}
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
  );
}
