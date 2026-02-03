'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { PlayerMessageItem } from './types';

function getLevelStyles(level: PlayerMessageItem['level']) {
  switch (level) {
    case 'CRITICAL':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    case 'WARNING':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

type MessageListItemProps = {
  message: PlayerMessageItem;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
};

export function MessageListItem({ message, compact = false, onClick, className }: MessageListItemProps) {
  const context = message.context as PlayerMessageItem['context'];
  const buildingLabel = context?.buildingName ?? (context?.marketZone ? `Warehouse - ${context.marketZone}` : null);

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-left rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          !message.isRead && 'border-l-4 border-l-primary',
          className
        )}
      >
        <div className="flex items-start gap-2">
          {!message.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn('text-[10px] font-normal', getLevelStyles(message.level))}>
                {message.level}
              </Badge>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{message.department}</span>
            </div>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{message.title}</p>
            {buildingLabel && (
              <p className="text-[10px] text-muted-foreground truncate">{buildingLabel}</p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">{formatRelativeTime(message.createdAt)}</p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        !message.isRead && 'border-l-4 border-l-primary',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {!message.isRead && (
          <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-xs font-normal', getLevelStyles(message.level))}>
              {message.level}
            </Badge>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{message.department}</span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-foreground">{message.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{message.body}</p>
          {buildingLabel && (
            <p className="mt-1 text-xs text-muted-foreground">{buildingLabel}</p>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">{formatRelativeTime(message.createdAt)}</p>
        </div>
      </div>
    </button>
  );
}
