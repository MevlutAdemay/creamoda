/**
 * Get all seasonality profiles for dropdown
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const profiles = await prisma.seasonalityProfile.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        season: true,
        isActive: true,
      },
      where: {
        isActive: true,
      },
      orderBy: [
        { season: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error fetching seasonality profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seasonality profiles' },
      { status: 500 }
    );
  }
}
