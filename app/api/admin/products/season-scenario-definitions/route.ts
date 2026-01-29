/**
 * Get all season scenario definitions for dropdown
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const definitions = await prisma.seasonScenarioDefinition.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        season: true,
        timing: true,
        variant: true,
        isActive: true,
      },
      where: {
        isActive: true,
      },
      orderBy: [
        { season: 'asc' },
        { timing: 'asc' },
        { variant: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(definitions);
  } catch (error) {
    console.error('Error fetching season scenario definitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch season scenario definitions' },
      { status: 500 }
    );
  }
}
