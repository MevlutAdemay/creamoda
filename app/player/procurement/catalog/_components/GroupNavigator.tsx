'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { CatalogGroup } from '../_lib/types';

type GroupNavigatorProps = {
  groups: CatalogGroup[];
  value: string;
  onValueChange: (value: string) => void;
};

export function GroupNavigator({ groups, value, onValueChange }: GroupNavigatorProps) {
  return (
    <div
      role="tablist"
      aria-label="Manufacturing groups"
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border"
    >
      {groups.map((group) => {
        const isActive = value === group.value;
        return (
          <button
            key={group.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange(group.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors shrink-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/60 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
            )}
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
          </button>
        );
      })}
    </div>
  );
}
