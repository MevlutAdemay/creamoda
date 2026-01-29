/**
 * Get all size profiles for dropdown
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const profiles = await prisma.sizeProfile.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error fetching size profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch size profiles' },
      { status: 500 }
    );
  }
}
