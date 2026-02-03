'use client';

import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
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

type MessageDetailDrawerProps = {
  message: PlayerMessageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkRead?: (messageId: string) => void;
  onMarkReadDone?: () => void;
};

export function MessageDetailDrawer({
  message,
  open,
  onOpenChange,
  onMarkRead,
  onMarkReadDone,
}: MessageDetailDrawerProps) {
  const router = useRouter();

  if (!message) return null;

  const context = message.context as PlayerMessageItem['context'];
  const buildingLabel = context?.buildingName ?? (context?.marketZone ? `Warehouse - ${context.marketZone}` : null);
  const payload = message.ctaPayload as { route?: string; buildingId?: string; tab?: string } | null;
  const bullets = Array.isArray(message.bullets) ? message.bullets : [];

  const handleCtaClick = () => {
    if (!payload?.route) return;
    const params = new URLSearchParams();
    if (payload.buildingId) params.set('buildingId', payload.buildingId);
    if (payload.tab) params.set('tab', payload.tab);
    const qs = params.toString();
    router.push(qs ? `${payload.route}?${qs}` : payload.route);
    onOpenChange(false);
  };

  const handleMarkRead = () => {
    if (!message.isRead && onMarkRead) {
      onMarkRead(message.id);
      onMarkReadDone?.();
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-xs font-normal', getLevelStyles(message.level))}>
              {message.level}
            </Badge>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{message.department}</span>
          </div>
          <SheetTitle className="text-left text-base font-semibold">{message.title}</SheetTitle>
          <p className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</p>
          {buildingLabel && (
            <p className="text-xs text-muted-foreground">{buildingLabel}</p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          <div className="whitespace-pre-line break-words leading-relaxed text-sm text-foreground">
            {message.body}
          </div>

          {bullets.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs text-right w-20">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bullets.map((row, i) => (
                    <TableRow key={i} className="text-sm">
                      <TableCell className="font-medium">
                        {(row as { productName?: string }).productName ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(row as { qty?: number }).qty ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 sm:flex-row">
          {!message.isRead && onMarkRead && (
            <Button variant="outline" size="sm" onClick={handleMarkRead}>
              Mark as read
            </Button>
          )}
          {payload?.route && (
            <Button size="sm" onClick={handleCtaClick}>
              {message.ctaLabel ?? 'Open'}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
