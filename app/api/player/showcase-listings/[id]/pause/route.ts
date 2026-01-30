/**
 * POST /api/player/showcase-listings/:id/pause
 * Pause a listing (status=PAUSED, pausedReason=MANUAL).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const listing = await prisma.showcaseListing.findFirst({
      where: { id, companyId: company.id },
      select: { id: true },
    });
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    await prisma.showcaseListing.update({
      where: { id },
      data: {
        status: 'PAUSED',
        pausedReason: 'MANUAL',
        pausedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[showcase-listings pause]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to pause listing' },
      { status: 500 }
    );
  }
}
