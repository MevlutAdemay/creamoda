// app/player/finance/_components/finance-inbox-panel.tsx
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

type InboxItem = {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  category?: string;
};

type Props = { items: InboxItem[] };

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return s;
  }
}

export function FinanceInboxPanel({ items }: Props) {
  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Finance Inbox
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/player/messages">View all</Link>
        </Button>
      </CardHeader>

      <CardContent className="pt-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finance messages yet.</p>
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            {/* header */}
            <div className="grid grid-cols-[120px_1fr] gap-3 bg-muted/30 px-3 py-2 text-[11px] font-medium text-muted-foreground select-none">
              <div>Time</div>
              <div>Message</div>
            </div>

            {/* rows */}
            <div className="divide-y divide-border/60">
              {items.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'grid grid-cols-[120px_1fr] gap-3 px-3 py-3',
                    'hover:bg-muted/20 transition-colors'
                  )}
                >
                  <div className="text-[11px] text-muted-foreground tabular-nums leading-snug">
                    {fmtDate(m.createdAt)}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">
                      {m.title}
                    </div>

                    {/* Body: readable, line breaks preserved */}
                    <div className="mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {m.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
