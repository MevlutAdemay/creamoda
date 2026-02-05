// app/api/player/advance-day/route.ts

/**
 * Advance company game day by one day.
 * POST: runs advanceCompanyDay (tick + settlement on 5th/20th). Single entry point.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { advanceCompanyDay, ADVANCE_DAY_CONCURRENT } from '@/lib/game/advance-day';
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

    const [wallet, unread] = await Promise.all([
      prisma.playerWallet.findUnique({
        where: { userId: session.user.id },
        select: { balanceUsd: true, balanceXp: true, balanceDiamond: true },
      }),
      prisma.playerMessage.count({
        where: { playerId: session.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({
      previousDayKey: formatDayKeyString(result.previousDayKey),
      newDayKey: formatDayKeyString(result.newDayKey),
      warehousesTicked: result.warehousesTicked,
      settlementsRun: result.settlementsRun,
      wallet: wallet
        ? {
            balanceUsd: Number(wallet.balanceUsd),
            balanceXp: wallet.balanceXp,
            balanceDiamond: wallet.balanceDiamond,
          }
        : null,
      unread,
    });
  } catch (e) {
    if (e instanceof Error && e.message === ADVANCE_DAY_CONCURRENT) {
      return NextResponse.json(
        { error: 'Already advanced / concurrent request' },
        { status: 409 }
      );
    }
    const message =
      e instanceof Error
        ? e.message
        : typeof (e as { message?: string })?.message === 'string'
          ? (e as { message: string }).message
          : 'Failed to advance day';
    console.error('[advance-day]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
