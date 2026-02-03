/**
 * POST /api/player/messages/mark-all-read
 * Body: { level?: string, department?: string } (optional filters)
 * Marks all matching messages for the current player as read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import type { MessageLevel, DepartmentCode } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const playerId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const levelParam = body.level as string | undefined;
    const departmentParam = body.department as string | undefined;

    const where: { playerId: string; isRead?: boolean; level?: MessageLevel; department?: DepartmentCode } = {
      playerId,
      isRead: false,
    };
    if (levelParam && ['INFO', 'WARNING', 'CRITICAL'].includes(levelParam)) {
      where.level = levelParam as MessageLevel;
    }
    if (departmentParam) {
      where.department = departmentParam as DepartmentCode;
    }

    await prisma.playerMessage.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });

    const unread = await prisma.playerMessage.count({
      where: { playerId, isRead: false },
    });

    return NextResponse.json({ ok: true, unread });
  } catch (err) {
    console.error('POST /api/player/messages/mark-all-read error:', err);
    return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 });
  }
}
