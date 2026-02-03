/**
 * GET /api/player/warehouse/stock/movements
 * Query: buildingId, productTemplateId, limit (optional, default 15)
 * Returns recent movements for a product in a warehouse (for detail panel).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const productTemplateId = searchParams.get('productTemplateId');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '15', 10) || 15, 50);

    if (!buildingId || !productTemplateId) {
      return NextResponse.json(
        { error: 'buildingId and productTemplateId are required' },
        { status: 400 }
      );
    }

    const company = await prisma.company.findFirst({
      where: { playerId: session.user.id },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const building = await prisma.companyBuilding.findFirst({
      where: {
        id: buildingId,
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
      },
      select: { id: true },
    });
    if (!building) {
      return NextResponse.json(
        { error: 'Warehouse not found or does not belong to your company' },
        { status: 404 }
      );
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        companyBuildingId: buildingId,
        productTemplateId,
      },
      select: {
        id: true,
        movementType: true,
        sourceType: true,
        qtyChange: true,
        unitCost: true,
        dayKey: true,
        createdAt: true,
        productTemplate: {
          select: { code: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(
      movements.map((m) => ({
        id: m.id,
        movementType: m.movementType,
        sourceType: m.sourceType,
        qtyChange: m.qtyChange,
        unitCost: m.unitCost != null ? Number(m.unitCost) : null,
        dayKey: m.dayKey.toISOString(),
        createdAt: m.createdAt.toISOString(),
        productCode: m.productTemplate.code,
        productName: m.productTemplate.name,
      }))
    );
  } catch (err) {
    console.error('GET /api/player/warehouse/stock/movements error:', err);
    return NextResponse.json(
      { error: 'Failed to load movements' },
      { status: 500 }
    );
  }
}
