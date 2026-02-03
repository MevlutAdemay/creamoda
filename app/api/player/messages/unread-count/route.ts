/**
 * GET /api/player/messages/unread-count
 * Returns current unread message count. Call after known actions or on app boot (no polling).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const unread = await prisma.playerMessage.count({
      where: { playerId: session.user.id, isRead: false },
    });

    return NextResponse.json({ unread });
  } catch (err) {
    console.error('GET /api/player/messages/unread-count error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
