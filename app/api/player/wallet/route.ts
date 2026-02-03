/**
 * GET /api/player/wallet
 * Returns current player wallet balances. Call after known wallet-mutating actions or on boot (no polling).
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

    const wallet = await prisma.playerWallet.findUnique({
      where: { userId: session.user.id },
      select: { balanceUsd: true, balanceXp: true, balanceDiamond: true },
    });

    if (!wallet) {
      return NextResponse.json({
        wallet: {
          balanceUsd: 0,
          balanceXp: 0,
          balanceDiamond: 0,
        },
      });
    }

    return NextResponse.json({
      wallet: {
        balanceUsd: Number(wallet.balanceUsd),
        balanceXp: wallet.balanceXp,
        balanceDiamond: wallet.balanceDiamond,
      },
    });
  } catch (err) {
    console.error('GET /api/player/wallet error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
