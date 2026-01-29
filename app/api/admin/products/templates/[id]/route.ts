/**
 * Product Template API (single)
 * PATCH: Update template
 * DELETE: Delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { Decimal } from '@prisma/client/runtime/library';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const {
      code,
      name,
      description,
      categoryL3Id,
      styleTags,
      productSeason,
      thermalClass,
      seasonalityProfileId,
      seasonScenarioDefinitionId,
      baseCost,
      suggestedSalePrice,
      productQuality,
      productRarity,
      shippingProfile,
      unlockCostXp,
      unlockCostDiamond,
      sizeProfileId,
      isActive,
    } = body;

    // Build update data
    const updateData: any = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (categoryL3Id !== undefined) {
      // Verify category is L3
      const category = await prisma.productCategoryNode.findUnique({
        where: { id: categoryL3Id },
        select: { level: true },
      });
      if (!category || category.level !== 'L3') {
        return NextResponse.json(
          { error: 'categoryL3Id must be an L3 category' },
          { status: 400 }
        );
      }
      updateData.categoryL3Id = categoryL3Id;
    }
    if (styleTags !== undefined) updateData.styleTags = styleTags;
    if (productSeason !== undefined) updateData.productSeason = productSeason;
    if (thermalClass !== undefined) updateData.thermalClass = thermalClass;
    if (seasonalityProfileId !== undefined) updateData.seasonalityProfileId = seasonalityProfileId || null;
    if (seasonScenarioDefinitionId !== undefined) updateData.seasonScenarioDefinitionId = seasonScenarioDefinitionId || null;
    if (baseCost !== undefined) updateData.baseCost = new Decimal(baseCost);
    if (suggestedSalePrice !== undefined) updateData.suggestedSalePrice = new Decimal(suggestedSalePrice);
    if (productQuality !== undefined) updateData.productQuality = productQuality;
    if (productRarity !== undefined) updateData.productRarity = productRarity;
    if (shippingProfile !== undefined) updateData.shippingProfile = shippingProfile;
    if (unlockCostXp !== undefined) updateData.unlockCostXp = unlockCostXp || null;
    if (unlockCostDiamond !== undefined) updateData.unlockCostDiamond = unlockCostDiamond || null;
    if (sizeProfileId !== undefined) {
      // Normalize sizeProfileId: '__none__', empty string, undefined, or null -> null
      const normalizedSizeProfileId = 
        !sizeProfileId || 
        sizeProfileId === '__none__' || 
        sizeProfileId === '' || 
        sizeProfileId === null ||
        sizeProfileId === undefined
          ? null 
          : String(sizeProfileId).trim() || null;
      
      // Validate sizeProfileId if provided
      if (normalizedSizeProfileId) {
        const sizeProfileExists = await prisma.sizeProfile.findUnique({
          where: { id: normalizedSizeProfileId },
        });
        if (!sizeProfileExists) {
          return NextResponse.json(
            { error: `SizeProfile with id ${normalizedSizeProfileId} not found` },
            { status: 400 }
          );
        }
      }
      
      updateData.sizeProfileId = normalizedSizeProfileId;
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const template = await prisma.productTemplate.update({
      where: { id },
      data: updateData,
      include: {
        categoryL3: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        sizeProfile: {
          select: {
            id: true,
            name: true,
          },
        },
        seasonalityProfile: {
          select: {
            id: true,
            code: true,
            name: true,
            season: true,
          },
        },
        seasonScenarioDefinition: {
          select: {
            id: true,
            code: true,
            name: true,
            season: true,
            timing: true,
            variant: true,
          },
        },
      },
    });

    return NextResponse.json(template);
  } catch (err: any) {
    const errorDetails: any = {
      error: 'Failed to update template',
      details: err instanceof Error ? err.message : String(err),
    };

    if (err?.code) {
      errorDetails.prismaCode = err.code;
      if (err.code === 'P2025') {
        errorDetails.error = 'Template not found';
        return NextResponse.json(errorDetails, { status: 404 });
      }
      if (err.code === 'P2002') {
        errorDetails.error = 'Template with this code already exists';
        return NextResponse.json(errorDetails, { status: 409 });
      }
    }

    return NextResponse.json(errorDetails, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;

    // Check if template has images
    const images = await prisma.productImageTemplate.count({
      where: { productTemplateId: id },
    });

    if (images > 0) {
      return NextResponse.json(
        { error: 'Cannot delete template with images. Delete images first.' },
        { status: 409 }
      );
    }

    // Check if template is used in player products
    const playerProducts = await prisma.playerProduct.count({
      where: { productTemplateId: id },
    });

    if (playerProducts > 0) {
      return NextResponse.json(
        { error: 'Cannot delete template used in player products' },
        { status: 409 }
      );
    }

    await prisma.productTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const errorDetails: any = {
      error: 'Failed to delete template',
      details: err instanceof Error ? err.message : String(err),
    };

    if (err?.code) {
      errorDetails.prismaCode = err.code;
      if (err.code === 'P2025') {
        errorDetails.error = 'Template not found';
        return NextResponse.json(errorDetails, { status: 404 });
      }
    }

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
