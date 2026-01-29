// app/api/admin/wholesales/suppliers/[id]/catalog/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';

type Params = { params: Promise<{ id: string }> };

type CreateCatalogItemBody = {
  productTemplateId: string;
  isActive?: boolean;
  clientMultiplierPreview?: number; // Ignored, server recalculates
};

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const supplier = await prisma.wholesaleSupplier.findUnique({
      where: { id },
      include: {
        country: {
          select: {
            id: true,
            name: true,
          },
        },
        city: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { ok: false, error: 'Supplier not found' },
        { status: 404 }
      );
    }

    const items = await prisma.wholesaleCatalogItem.findMany({
      where: { wholesaleSupplierId: id },
      include: {
        productTemplate: {
          select: {
            id: true,
            code: true,
            name: true,
            baseCost: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        marketZoneId: supplier.marketZoneId,
        country: supplier.country,
        city: supplier.city,
        minPriceMultiplier: supplier.minPriceMultiplier,
        maxPriceMultiplier: supplier.maxPriceMultiplier,
        isActive: supplier.isActive,
      },
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch catalog';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as CreateCatalogItemBody;

    // Validate required fields
    if (!body.productTemplateId) {
      return NextResponse.json(
        { ok: false, error: 'productTemplateId is required' },
        { status: 400 }
      );
    }

    // Fetch supplier to get multipliers
    const supplier = await prisma.wholesaleSupplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return NextResponse.json(
        { ok: false, error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Fetch product template to get baseCost
    const template = await prisma.productTemplate.findUnique({
      where: { id: body.productTemplateId },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: 'Product template not found' },
        { status: 404 }
      );
    }

    if (!template.isActive) {
      return NextResponse.json(
        { ok: false, error: 'Product template is not active' },
        { status: 400 }
      );
    }

    // Check for duplicate (unique constraint)
    const existing = await prisma.wholesaleCatalogItem.findUnique({
      where: {
        wholesaleSupplierId_productTemplateId: {
          wholesaleSupplierId: id,
          productTemplateId: body.productTemplateId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'This product is already in the catalog' },
        { status: 409 }
      );
    }

    // Calculate price on server (ignore client preview)
    const min = Number(supplier.minPriceMultiplier);
    const max = Number(supplier.maxPriceMultiplier);
    const multiplier = Number((min + Math.random() * (max - min)).toFixed(4));
    const baseCost = Number(template.baseCost);
    const wholesalePrice = Number((baseCost * multiplier).toFixed(2));

    const created = await prisma.wholesaleCatalogItem.create({
      data: {
        wholesaleSupplierId: id,
        productTemplateId: body.productTemplateId,
        wholesalePrice: wholesalePrice.toString(),
        isActive: body.isActive ?? true,
      },
      include: {
        productTemplate: {
          select: {
            id: true,
            code: true,
            name: true,
            baseCost: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create catalog item';
    console.error('Create catalog item error:', error);
    
    // Handle unique constraint error
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { ok: false, error: 'This product is already in the catalog' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
