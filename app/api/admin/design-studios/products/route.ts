// app/api/admin/design-studios/products/route.ts
// Get products filtered by styleTag and quality

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { StyleTag, ProductQuality } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const styleTag = searchParams.get('styleTag') as StyleTag | null;
    const quality = searchParams.get('quality') as ProductQuality | null;
    const search = searchParams.get('search') || '';

    const where: any = {
      isActive: true,
    };

    if (styleTag) {
      where.styleTags = {
        has: styleTag,
      };
    }

    if (quality) {
      where.productQuality = quality;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.productTemplate.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        productQuality: true,
        styleTags: true,
        productSeason: true,
      },
      orderBy: { code: 'asc' },
      take: 100,
    });

    return NextResponse.json({ products });
  } catch (err) {
    console.error('Error fetching products:', err);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
