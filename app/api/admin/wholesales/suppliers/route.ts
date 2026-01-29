// app/api/admin/wholesales/suppliers/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';
import type { Prisma, MarketZone, StyleTag } from '@prisma/client';

type CreateSupplierBody = {
  name: string;
  marketZoneId: MarketZone;
  styleTag: StyleTag;
  countryId?: string | null;
  cityId?: string | null;
  minPriceMultiplier: string;
  maxPriceMultiplier: string;
  isActive?: boolean;
};

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const isActive = searchParams.get('isActive');

    const where: Prisma.WholesaleSupplierWhereInput = {};
    
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }
    
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const items = await prisma.wholesaleSupplier.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch suppliers';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as CreateSupplierBody;

    // Validate required fields
    if (!body.name || !body.marketZoneId || !body.styleTag || !body.minPriceMultiplier || !body.maxPriceMultiplier) {
      return NextResponse.json(
        { ok: false, error: 'Name, marketZoneId, styleTag, minPriceMultiplier, and maxPriceMultiplier are required' },
        { status: 400 }
      );
    }

    // Parse and validate multipliers
    const minMultiplier = parseFloat(body.minPriceMultiplier);
    const maxMultiplier = parseFloat(body.maxPriceMultiplier);

    if (isNaN(minMultiplier) || minMultiplier <= 0) {
      return NextResponse.json(
        { ok: false, error: 'minPriceMultiplier must be a positive number' },
        { status: 400 }
      );
    }

    if (isNaN(maxMultiplier) || maxMultiplier < minMultiplier) {
      return NextResponse.json(
        { ok: false, error: 'maxPriceMultiplier must be >= minPriceMultiplier' },
        { status: 400 }
      );
    }

    // Validate city requires country
    if (body.cityId && !body.countryId) {
      return NextResponse.json(
        { ok: false, error: 'City requires country to be selected' },
        { status: 400 }
      );
    }

    // Round to 2 decimals for storage
    const minMultiplierRounded = Math.round(minMultiplier * 100) / 100;
    const maxMultiplierRounded = Math.round(maxMultiplier * 100) / 100;

    const created = await prisma.wholesaleSupplier.create({
      data: {
        name: body.name,
        marketZoneId: body.marketZoneId,
        styleTag: body.styleTag,
        countryId: body.countryId || null,
        cityId: body.cityId || null,
        minPriceMultiplier: minMultiplierRounded.toString(),
        maxPriceMultiplier: maxMultiplierRounded.toString(),
        isActive: body.isActive ?? true,
      },
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

    return NextResponse.json({ ok: true, item: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create supplier';
    console.error('Create supplier error:', error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
