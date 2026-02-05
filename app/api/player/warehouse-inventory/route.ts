/**
 * GET /api/player/warehouse-inventory?warehouseBuildingId=...
 * Returns BuildingInventoryItem rows for the warehouse (qtyOnHand > 0, not archived).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';

type PlayerProductWithImages = {
  id: string;
  images: Array<{
    id: string;
    isUnlocked: boolean;
    paidXp: number | null;
    paidDiamond: number | null;
    unlockType: string | null;
    urlOverride: string | null;
    productImageTemplate: { id: string; url: string };
  }>;
};

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

    const playerProductIds = [...new Set(items.map((i) => i.playerProductId).filter(Boolean))] as string[];
    let imagesByPlayerProductId: Record<string, Array<{
      id: string;
      isUnlocked: boolean;
      paidXp: number | null;
      paidDiamond: number | null;
      unlockType: string | null;
      urlOverride: string | null;
      templateUrl: string | null;
      displayUrl: string | null;
    }>> = {};
    if (playerProductIds.length > 0) {
      const playerProducts = await prisma.playerProduct.findMany({
        where: { id: { in: playerProductIds } },
        select: {
          id: true,
          images: {
            orderBy: [{ sortOrder: 'asc' }],
            select: {
              id: true,
              isUnlocked: true,
              paidXp: true,
              paidDiamond: true,
              unlockType: true,
              urlOverride: true,
              productImageTemplate: { select: { id: true, url: true } },
            },
          },
        } as any,
      });
      imagesByPlayerProductId = Object.fromEntries(
        playerProducts.map((pp) => [
          pp.id,
          (pp as unknown as PlayerProductWithImages).images.map((img) => ({
            id: img.id,
            isUnlocked: img.isUnlocked,
            paidXp: img.paidXp,
            paidDiamond: img.paidDiamond,
            unlockType: img.unlockType,
            urlOverride: img.urlOverride,
            templateUrl: img.productImageTemplate?.url ?? null,
            displayUrl: img.urlOverride ?? img.productImageTemplate?.url ?? null,
          })),
        ])
      );
    }

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
        images: (i.playerProductId ? imagesByPlayerProductId[i.playerProductId] ?? [] : []),
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
