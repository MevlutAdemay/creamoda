// app/api/admin/wholesales/suppliers/[id]/catalog/[catalogItemId]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';

type Params = { 
  params: Promise<{ 
    id: string;
    catalogItemId: string;
  }> 
};

type UpdateCatalogItemBody = {
  wholesalePrice?: string;
  isActive?: boolean;
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { catalogItemId } = await params;
    const body = (await req.json()) as UpdateCatalogItemBody;

    // Check if catalog item exists
    const current = await prisma.wholesaleCatalogItem.findUnique({
      where: { id: catalogItemId },
    });

    if (!current) {
      return NextResponse.json(
        { ok: false, error: 'Catalog item not found' },
        { status: 404 }
      );
    }

    // Validate wholesalePrice if provided
    if (body.wholesalePrice !== undefined) {
      const price = parseFloat(body.wholesalePrice);
      if (isNaN(price) || price <= 0) {
        return NextResponse.json(
          { ok: false, error: 'wholesalePrice must be a positive number' },
          { status: 400 }
        );
      }
    }

    const data: { wholesalePrice?: string; isActive?: boolean } = {};
    if (body.wholesalePrice !== undefined) {
      const price = parseFloat(body.wholesalePrice);
      data.wholesalePrice = price.toFixed(2);
    }
    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }

    const updated = await prisma.wholesaleCatalogItem.update({
      where: { id: catalogItemId },
      data,
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

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update catalog item';
    console.error('Update catalog item error:', error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { catalogItemId } = await params;
    
    // Check if catalog item exists
    const item = await prisma.wholesaleCatalogItem.findUnique({
      where: { id: catalogItemId },
    });

    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'Catalog item not found' },
        { status: 404 }
      );
    }

    await prisma.wholesaleCatalogItem.delete({ where: { id: catalogItemId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete catalog item';
    console.error('Delete catalog item error:', error);
    
    // Handle FK constraint errors
    if (error instanceof Error && error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        { ok: false, error: 'Cannot delete catalog item with existing related records' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
