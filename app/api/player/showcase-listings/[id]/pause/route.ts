/**
 * POST /api/player/showcase-listings/:id/pause
 * Remove listing (delete). Option A: same route, behavior changed to delete so UI keeps calling it.
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
    const deleted = await prisma.showcaseListing.deleteMany({
      where: { id, companyId: company.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[showcase-listings pause]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to remove listing' },
      { status: 500 }
    );
  }
}
