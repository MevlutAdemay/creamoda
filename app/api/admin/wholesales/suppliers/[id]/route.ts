// app/api/admin/wholesales/suppliers/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';
import type { Prisma, MarketZone, StyleTag } from '@prisma/client';


type UpdateSupplierBody = {
  name?: string;
  marketZoneId?: MarketZone;
  styleTag?: StyleTag;
  countryId?: string | null;
  cityId?: string | null;
  minPriceMultiplier?: string;
  maxPriceMultiplier?: string;
  isActive?: boolean;
};

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as UpdateSupplierBody;

    // Check if supplier exists
    const current = await (prisma as any).wholesaleSupplier.findUnique({
      where: { id },
    });

    if (!current) {
      return NextResponse.json(
        { ok: false, error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Validate multipliers if provided
    let minMultiplier = current.minPriceMultiplier ? Number(current.minPriceMultiplier) : undefined;
    let maxMultiplier = current.maxPriceMultiplier ? Number(current.maxPriceMultiplier) : undefined;

    if (body.minPriceMultiplier !== undefined) {
      minMultiplier = parseFloat(body.minPriceMultiplier);
      if (isNaN(minMultiplier) || minMultiplier <= 0) {
        return NextResponse.json(
          { ok: false, error: 'minPriceMultiplier must be a positive number' },
          { status: 400 }
        );
      }
    }

    if (body.maxPriceMultiplier !== undefined) {
      maxMultiplier = parseFloat(body.maxPriceMultiplier);
      if (isNaN(maxMultiplier)) {
        return NextResponse.json(
          { ok: false, error: 'maxPriceMultiplier must be a valid number' },
          { status: 400 }
        );
      }
    }

    // Validate max >= min
    if (minMultiplier !== undefined && maxMultiplier !== undefined && maxMultiplier < minMultiplier) {
      return NextResponse.json(
        { ok: false, error: 'maxPriceMultiplier must be >= minPriceMultiplier' },
        { status: 400 }
      );
    }

    // Validate city requires country
    const countryId = body.countryId !== undefined ? body.countryId : current.countryId;
    const cityId = body.cityId !== undefined ? body.cityId : current.cityId;
    
    if (cityId && !countryId) {
      return NextResponse.json(
        { ok: false, error: 'City requires country to be selected' },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.marketZoneId !== undefined) data.marketZoneId = body.marketZoneId;
    if (body.styleTag !== undefined) data.styleTag = body.styleTag;
    if (body.countryId !== undefined) {
      data.country = body.countryId ? { connect: { id: body.countryId } } : { disconnect: true };
    }
    if (body.cityId !== undefined) {
      data.city = body.cityId ? { connect: { id: body.cityId } } : { disconnect: true };
    }
    if (body.minPriceMultiplier !== undefined) {
      const rounded = Math.round(minMultiplier! * 100) / 100;
      data.minPriceMultiplier = rounded.toString();
    }
    if (body.maxPriceMultiplier !== undefined) {
      const rounded = Math.round(maxMultiplier! * 100) / 100;
      data.maxPriceMultiplier = rounded.toString();
    }
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await (prisma as any).wholesaleSupplier.update({
      where: { id },
      data,
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
        _count: {
          select: {
            catalogItems: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update supplier';
    console.error('Update supplier error:', error);
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

    const { id } = await params;
    
    // Check if supplier exists
    const supplier = await (prisma as any).wholesaleSupplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { catalogItems: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { ok: false, error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Catalog items will be deleted automatically (Cascade)
    await (prisma as any).wholesaleSupplier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete supplier';
    console.error('Delete supplier error:', error);
    
    // Handle FK constraint errors
    if (error instanceof Error && error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        { ok: false, error: 'Cannot delete supplier with existing related records' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
