// app/api/admin/wholesales/countries/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';
import { MarketZone } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const marketZoneId = searchParams.get('marketZoneId') as MarketZone | null;

    const where: { marketZone?: MarketZone } = {};
    if (marketZoneId) {
      where.marketZone = marketZoneId;
    }

    const countries = await prisma.country.findMany({
      where,
      select: {
        id: true,
        name: true,
        iso2: true,
        marketZone: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(countries);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch countries';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
