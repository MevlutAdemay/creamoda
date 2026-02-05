'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageListItem } from '@/components/player/messages/MessageListItem';
import { MessageDetailDrawer } from '@/components/player/messages/MessageDetailDrawer';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { Inbox } from 'lucide-react';
import type { PlayerMessageItem } from '@/components/player/messages/types';
import { useInboxUnread } from '@/stores/useInboxUnread';

const DASHBOARD_LIMIT = 5;

export function InboxWidget() {
  const [items, setItems] = useState<PlayerMessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<PlayerMessageItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/player/messages?scope=dashboard&limit=${DASHBOARD_LIMIT}`
      );
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleOpenMessage = (message: PlayerMessageItem) => {
    setSelectedMessage(message);
    setDrawerOpen(true);
  };

  const { setUnread } = useInboxUnread();

  const handleMarkRead = useCallback(async (messageId: string) => {
    const res = await fetch('/api/player/messages/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const next = typeof data.unread === 'number' ? data.unread : Math.max(0, unreadCount - 1);
      setItems((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
        )
      );
      setUnreadCount(next);
      setUnread(next);
      setSelectedMessage((m) =>
        m?.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
      );
    }
  }, [unreadCount, setUnread]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            Inbox
            {unreadCount > 0 && (
              <Badge variant="secondary" className="tabular-nums text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/player/messages">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <ModaVerseLogoLoader size={36} className="text-primary" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No messages</p>
          ) : (
            <ul className="space-y-2">
              {items.map((message) => (
                <li key={message.id}>
                  <MessageListItem
                    message={message}
                    compact
                    onClick={() => handleOpenMessage(message)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <MessageDetailDrawer
        message={selectedMessage}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onMarkRead={handleMarkRead}
        onMarkReadDone={() => {}}
      />
    </>
  );
}
