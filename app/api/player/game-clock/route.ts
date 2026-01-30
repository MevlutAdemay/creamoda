/**
 * GET: Return current game dayKey for the logged-in player's company.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { formatDayKeyString } from '@/lib/game/game-clock';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst({
      where: { playerId: session.user.id },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentDayKey = await getCompanyGameDayKey(company.id);
    return NextResponse.json({
      currentDayKey: formatDayKeyString(currentDayKey),
      currentDayKeyIso: currentDayKey.toISOString(),
    });
  } catch (e) {
    console.error('[game-clock]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to get game clock' },
      { status: 500 }
    );
  }
}
