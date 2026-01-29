// app/api/admin/design-studios/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { ProductSeason, StyleTag, ProductQuality, StudioStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const studios = await prisma.designStudio.findMany({
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ studios });
  } catch (err) {
    console.error('Error fetching design studios:', err);
    return NextResponse.json(
      { error: 'Failed to fetch design studios', details: err instanceof Error ? err.message : String(err) },
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
      code,
      title,
      description,
      shortPitch,
      productSeason,
      styleTag,
      quality,
      status,
      coverImageUrl,
      sortOrder,
    } = body;

    // Validation
    if (!code || !title || !productSeason || !styleTag || !quality) {
      return NextResponse.json(
        { error: 'code, title, productSeason, styleTag, and quality are required' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await prisma.designStudio.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Design studio with this code already exists' },
        { status: 400 }
      );
    }

    const studio = await prisma.designStudio.create({
      // @ts-expect-error - shortPitch exists in schema but TypeScript types may be stale
      data: {
        code,
        title,
        description: description || null,
        shortPitch: shortPitch || null,
        productSeason: productSeason as ProductSeason,
        styleTag: styleTag as StyleTag,
        quality: quality as ProductQuality,
        status: (status as StudioStatus) || 'DRAFT',
        coverImageUrl: coverImageUrl || null,
        sortOrder: sortOrder || 0,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json({ studio });
  } catch (err) {
    console.error('Error creating design studio:', err);
    return NextResponse.json(
      { error: 'Failed to create design studio', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
