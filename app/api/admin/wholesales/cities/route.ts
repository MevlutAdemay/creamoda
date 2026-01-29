// app/api/admin/wholesales/cities/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get('countryId');

    if (!countryId) {
      return NextResponse.json(
        { ok: false, error: 'countryId is required' },
        { status: 400 }
      );
    }

    const cities = await prisma.city.findMany({
      where: { countryId },
      select: {
        id: true,
        name: true,
        slug: true,
        countryId: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(cities);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch cities';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
