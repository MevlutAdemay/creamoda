/**
 * POST /api/player/messages/mark-read
 * Body: { messageId: string }
 * Sets isRead=true, readAt=now for the message if it belongs to the current player.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const playerId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : null;
    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    const updated = await prisma.playerMessage.updateMany({
      where: { id: messageId, playerId },
      data: { isRead: true, readAt: new Date() },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Message not found or forbidden' }, { status: 404 });
    }

    const unread = await prisma.playerMessage.count({
      where: { playerId, isRead: false },
    });

    return NextResponse.json({ ok: true, unread });
  } catch (err) {
    console.error('POST /api/player/messages/mark-read error:', err);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
