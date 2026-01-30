/**
 * GET /api/player/warehouse-inventory?warehouseBuildingId=...
 * Returns BuildingInventoryItem rows for the warehouse (qtyOnHand > 0, not archived).
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
    const warehouseBuildingId = searchParams.get('warehouseBuildingId');
    if (!warehouseBuildingId) {
      return NextResponse.json(
        { error: 'warehouseBuildingId is required' },
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

    const warehouse = await prisma.companyBuilding.findFirst({
      where: {
        id: warehouseBuildingId,
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
      },
      select: { id: true },
    });
    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found or does not belong to your company' },
        { status: 404 }
      );
    }

    const items = await prisma.buildingInventoryItem.findMany({
      where: {
        companyBuildingId: warehouseBuildingId,
        qtyOnHand: { gt: 0 },
        isArchived: false,
      },
      select: {
        id: true,
        productTemplateId: true,
        playerProductId: true,
        qtyOnHand: true,
        avgUnitCost: true,
        productTemplate: {
          select: {
            id: true,
            name: true,
            code: true,
            suggestedSalePrice: true,
            productQuality: true,
          },
        },
      },
    });

    return NextResponse.json({
      items: items.map((i) => ({
        inventoryItemId: i.id,
        productTemplateId: i.productTemplateId,
        playerProductId: i.playerProductId,
        qtyOnHand: i.qtyOnHand,
        avgUnitCost: i.avgUnitCost.toString(),
        productTemplate: i.productTemplate
          ? {
              id: i.productTemplate.id,
              name: i.productTemplate.name,
              code: i.productTemplate.code,
              suggestedSalePrice: i.productTemplate.suggestedSalePrice.toString(),
              productQuality: i.productTemplate.productQuality,
            }
          : null,
      })),
    });
  } catch (e) {
    console.error('[warehouse-inventory]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load inventory' },
      { status: 500 }
    );
  }
}
