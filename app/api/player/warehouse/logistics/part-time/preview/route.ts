/**
 * Part-time staff preview (read-only).
 * GET ?buildingId=...&staffCount=...
 * Returns willClear, costUsd, etc. No DB writes.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';

const CAPACITY_PER_WORKER = 20;
const BASE_COST_PER_WORKER = 60;
const STAFF_COUNT_MAX = 200;

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId')?.trim() ?? '';
    const staffCountRaw = searchParams.get('staffCount');
    const staffCount = Math.max(
      0,
      Math.min(STAFF_COUNT_MAX, parseInt(staffCountRaw ?? '0', 10) || 0)
    );

    const building = await prisma.companyBuilding.findFirst({
      where: {
        id: buildingId,
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
      },
      select: { id: true, countryId: true },
    });
    if (!building) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    const country = building.countryId
      ? await prisma.country.findUnique({
          where: { id: building.countryId },
          select: { salaryMultiplier: true },
        })
      : null;
    const salaryMultiplier = country?.salaryMultiplier
      ? Number(country.salaryMultiplier)
      : 1;

    const backlogItems = await prisma.modaverseOrderItem.findMany({
      where: {
        order: { warehouseBuildingId: buildingId, companyId: company.id },
      },
      select: { qtyOrdered: true, qtyFulfilled: true },
    });
    const backlogUnitsTotal = backlogItems
      .filter((i) => i.qtyFulfilled < i.qtyOrdered)
      .reduce((s, i) => s + (i.qtyOrdered - i.qtyFulfilled), 0);

    const extraCapacity = staffCount * CAPACITY_PER_WORKER;
    const willClear = Math.min(backlogUnitsTotal, extraCapacity);
    const costUsd = staffCount * BASE_COST_PER_WORKER * salaryMultiplier;

    return NextResponse.json({
      buildingId,
      staffCount,
      salaryMultiplier,
      backlogUnitsTotal,
      extraCapacity,
      willClear,
      costUsd,
    });
  } catch (e) {
    console.error('[part-time-preview]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Part-time preview failed' },
      { status: 500 }
    );
  }
}
