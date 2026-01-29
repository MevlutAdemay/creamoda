/**
 * Product Images API
 * GET: List images for a product template
 * POST: Create new image record
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const productTemplateId = searchParams.get('productTemplateId');

    if (!productTemplateId) {
      return NextResponse.json(
        { error: 'productTemplateId is required' },
        { status: 400 }
      );
    }

    const images = await prisma.productImageTemplate.findMany({
      where: { productTemplateId },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const {
      productTemplateId,
      slot,
      url,
      alt,
      unlockType,
      unlockCostXp,
      unlockCostDiamond,
      sortOrder = 0,
      meta,
    } = body;

    // Validation
    if (!productTemplateId || !url) {
      return NextResponse.json(
        { error: 'productTemplateId and url are required' },
        { status: 400 }
      );
    }

    // Verify template exists
    const template = await prisma.productTemplate.findUnique({
      where: { id: productTemplateId },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Product template not found' },
        { status: 404 }
      );
    }

    const image = await prisma.productImageTemplate.create({
      data: {
        productTemplateId,
        slot: slot || 'MAIN',
        url,
        alt: alt || null,
        unlockType: unlockType || 'ALWAYS',
        unlockCostXp: unlockCostXp || null,
        unlockCostDiamond: unlockCostDiamond || null,
        sortOrder,
        meta: meta || null,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error: any) {
    console.error('Error creating image:', error);
    return NextResponse.json(
      { error: 'Failed to create image', details: error.message },
      { status: 500 }
    );
  }
}
