// app/api/admin/locations/countries/route.ts
/**
 * Get all countries for location selection (wizard use)
 * Available to all authenticated users
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const countries = await prisma.country.findMany({
      select: {
        id: true,
        name: true,
        iso2: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ countries });
  } catch (error) {
    console.error('Error fetching countries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch countries' },
      { status: 500 }
    );
  }
}
