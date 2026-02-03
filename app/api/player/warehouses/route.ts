/**
 * GET /api/player/warehouses
 * Session userId -> Company (playerId) -> CompanyBuilding where role = WAREHOUSE
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';

export async function GET() {
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

    const warehouses = await prisma.companyBuilding.findMany({
      where: {
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
      },
      select: {
        id: true,
        name: true,
        marketZone: true,
        country: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      warehouses: warehouses.map((w) => ({
        id: w.id,
        name: w.name ?? null,
        marketZone: w.marketZone ?? null,
        countryName: w.country?.name ?? null,
      })),
    });
  } catch (e) {
    console.error('[warehouses]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load warehouses' },
      { status: 500 }
    );
  }
}
