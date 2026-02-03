'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MessageListItem } from '@/components/player/messages/MessageListItem';
import { MessageDetailDrawer } from '@/components/player/messages/MessageDetailDrawer';
import { Inbox } from 'lucide-react';
import type { PlayerMessageItem } from '@/components/player/messages/types';
import { useInboxUnread } from '@/stores/useInboxUnread';

type TabValue = 'unread' | 'all' | 'critical' | 'operations';

export default function MessagesPage() {
  const [items, setItems] = useState<PlayerMessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>('unread');
  const [selectedMessage, setSelectedMessage] = useState<PlayerMessageItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { setUnread } = useInboxUnread();

  const fetchMessages = useCallback(async (tab: TabValue) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('scope', 'full');
    params.set('limit', '50');
    if (tab === 'unread') params.set('onlyUnread', 'true');
    if (tab === 'critical') params.set('level', 'CRITICAL');
    if (tab === 'operations') params.set('department', 'WAREHOUSE');
    try {
      const res = await fetch(`/api/player/messages?${params}`);
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
    fetchMessages(activeTab);
  }, [activeTab, fetchMessages]);

  const handleOpenMessage = (message: PlayerMessageItem) => {
    setSelectedMessage(message);
    setDrawerOpen(true);
  };

  const handleMarkRead = useCallback(async (messageId: string) => {
    const res = await fetch('/api/player/messages/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setItems((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
        )
      );
      const next = typeof data.unread === 'number' ? data.unread : Math.max(0, unreadCount - 1);
      setUnreadCount(next);
      setUnread(next);
      setSelectedMessage((m) => (m?.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m));
    }
  }, [unreadCount, setUnread]);

  const handleMarkAllRead = useCallback(async () => {
    const res = await fetch('/api/player/messages/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const next = typeof data.unread === 'number' ? data.unread : 0;
      setUnreadCount(next);
      setUnread(next);
      setItems((prev) =>
        prev.map((m) => ({ ...m, isRead: true, readAt: new Date().toISOString() }))
      );
      setSelectedMessage((m) => (m ? { ...m, isRead: true, readAt: new Date().toISOString() } : null));
      fetchMessages(activeTab);
    }
  }, [activeTab, fetchMessages, setUnread]);

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
                <Inbox className="h-7 w-7 text-muted-foreground" />
                Inbox
              </h1>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                Mark all read
              </Button>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="bg-muted">
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="critical">Critical</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                      Loading…
                    </div>
                  ) : items.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      {activeTab === 'unread' ? "You're all caught up" : 'No messages'}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {items.map((message) => (
                        <li key={message.id}>
                          <MessageListItem
                            message={message}
                            compact={false}
                            onClick={() => handleOpenMessage(message)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <MessageDetailDrawer
        message={selectedMessage}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onMarkRead={handleMarkRead}
        onMarkReadDone={() => {}}
      />
    </div>
  );
}
