//app/api/admin/products/templates/route.ts

/**
 * Product Templates API
 * GET: List templates with search and pagination
 * POST: Create new template
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { Decimal } from '@prisma/client/runtime/library';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const take = parseInt(searchParams.get('take') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.productTemplate.findMany({
        where,
        take,
        skip,
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productTemplate.count({ where }),
    ]);

    return NextResponse.json({
      templates,
      total,
      skip,
      take,
    });
  } catch (err) {
    const errorDetails: any = {
      error: 'Internal Server Error',
      details: err instanceof Error ? err.message : String(err),
    };
    
    if ((err as any)?.code) {
      errorDetails.prismaCode = (err as any).code;
    }
    
    return NextResponse.json(errorDetails, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const {
      code,
      name,
      description,
      categoryL3Id,
      styleTags = [],
      productSeason,
      thermalClass,
      baseCost,
      suggestedSalePrice,
      productQuality,
      productRarity,
      shippingProfile,
      unlockCostXp,
      unlockCostDiamond,
      sizeProfileId,
      seasonScenarioDefinitionId,
      isActive = true,
    } = body;

    // Validation
    if (!code || !name || !categoryL3Id || !productSeason || !thermalClass) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (baseCost === undefined || suggestedSalePrice === undefined) {
      return NextResponse.json(
        { error: 'baseCost and suggestedSalePrice are required' },
        { status: 400 }
      );
    }

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

    const template = await prisma.productTemplate.create({
      data: {
        code,
        name,
        description: description || null,
        categoryL3Id,
        styleTags: styleTags || [],
        productSeason,
        thermalClass,
        seasonScenarioDefinitionId: seasonScenarioDefinitionId || null,
        baseCost: new Decimal(baseCost),
        suggestedSalePrice: new Decimal(suggestedSalePrice),
        productQuality,
        productRarity: productRarity || 'STANDARD',
        shippingProfile: shippingProfile || 'MEDIUM',
        unlockCostXp: unlockCostXp || null,
        unlockCostDiamond: unlockCostDiamond || null,
        sizeProfileId: normalizedSizeProfileId,
        isActive,
      },
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

    return NextResponse.json(template, { status: 201 });
  } catch (err: any) {
    const errorDetails: any = {
      error: err.code === 'P2002' ? 'Template with this code already exists' : 'Failed to create template',
      details: err instanceof Error ? err.message : String(err),
    };
    
    if (err?.code) {
      errorDetails.prismaCode = err.code;
    }
    
    const statusCode = err.code === 'P2002' ? 409 : 500;
    return NextResponse.json(errorDetails, { status: statusCode });
  }
}
