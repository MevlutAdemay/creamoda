/**
 * POST /api/player/guidance/tick  (or GET for manual trigger)
 * Runs collection guidance rules and writes deduped messages to PlayerMessage.
 * Also runs automatically when the game day advances (see advance-day.ts).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { runGuidanceTickForCompany } from '@/lib/game/guidance-tick';

export async function POST() {
  return handleTick();
}

/** GET: same as POST; open in browser while logged in to run tick (e.g. after setting dayKey to 2026-10-01). */
export async function GET() {
  return handleTick();
}

async function handleTick() {
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

    const result = await runGuidanceTickForCompany(company.id);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[guidance/tick]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Guidance tick failed' },
      { status: 500 }
    );
  }
}
