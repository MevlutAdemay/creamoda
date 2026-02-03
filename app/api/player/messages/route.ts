/**
 * GET /api/player/messages
 * Returns messages for the current player.
 * Query: scope=dashboard|full, onlyUnread=true|false, limit=number, level=CRITICAL|WARNING|INFO, department=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import type { MessageLevel, DepartmentCode } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const playerId = session.user.id;

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') ?? 'full';
    const onlyUnread = searchParams.get('onlyUnread') === 'true';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;
    const levelParam = searchParams.get('level') as MessageLevel | null;
    const departmentParam = searchParams.get('department') as DepartmentCode | null;

    const where: { playerId: string; isRead?: boolean; level?: MessageLevel; department?: DepartmentCode } = {
      playerId,
    };
    if (onlyUnread) where.isRead = false;
    if (levelParam && ['INFO', 'WARNING', 'CRITICAL'].includes(levelParam)) where.level = levelParam;
    if (departmentParam) where.department = departmentParam;

    const take = scope === 'dashboard' ? Math.min(limit, 10) : limit;

    const levelOrder: Record<MessageLevel, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

    const [rawItems, unreadCount] = await Promise.all([
      prisma.playerMessage.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        take: scope === 'dashboard' ? Math.max(take, 20) : take,
        select: {
          id: true,
          title: true,
          body: true,
          level: true,
          kind: true,
          department: true,
          category: true,
          isRead: true,
          readAt: true,
          createdAt: true,
          context: true,
          bullets: true,
          ctaType: true,
          ctaLabel: true,
          ctaPayload: true,
        },
      }),
      prisma.playerMessage.count({ where: { playerId, isRead: false } }),
    ]);

    let items = rawItems;
    if (scope === 'dashboard') {
      items = [...rawItems]
        .sort((a, b) => {
          if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
          const la = levelOrder[a.level] ?? 2;
          const lb = levelOrder[b.level] ?? 2;
          if (la !== lb) return la - lb;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, take);
    }

    return NextResponse.json({ items, unreadCount });
  } catch (err) {
    console.error('GET /api/player/messages error:', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
