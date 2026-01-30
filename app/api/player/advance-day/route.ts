/**
 * Advance company game day by one day.
 * POST: runs advanceCompanyDay (tick + settlement on 5th/20th). Single entry point.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { advanceCompanyDay } from '@/lib/game/advance-day';
import { formatDayKeyString } from '@/lib/game/game-clock';

export async function POST() {
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

    const result = await advanceCompanyDay(company.id);

    return NextResponse.json({
      previousDayKey: formatDayKeyString(result.previousDayKey),
      newDayKey: formatDayKeyString(result.newDayKey),
      warehousesTicked: result.warehousesTicked,
      settlementsRun: result.settlementsRun,
    });
  } catch (e) {
    console.error('[advance-day]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to advance day' },
      { status: 500 }
    );
  }
}
