// app/api/admin/design-studios/[id]/items/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;

    const items = await prisma.designStudioItem.findMany({
      where: { studioId: id },
      include: {
        productTemplate: {
          select: {
            id: true,
            code: true,
            name: true,
            productQuality: true,
            styleTags: true,
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error('Error fetching design studio items:', err);
    return NextResponse.json(
      { error: 'Failed to fetch design studio items', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { productTemplateId, isFeatured, sortOrder, note } = body;

    if (!productTemplateId) {
      return NextResponse.json(
        { error: 'productTemplateId is required' },
        { status: 400 }
      );
    }

    // Check if item already exists
    const existing = await prisma.designStudioItem.findUnique({
      where: {
        studioId_productTemplateId: {
          studioId: id,
          productTemplateId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This product is already in the studio' },
        { status: 400 }
      );
    }

    const item = await prisma.designStudioItem.create({
      data: {
        studioId: id,
        productTemplateId,
        isFeatured: isFeatured || false,
        sortOrder: sortOrder || 0,
        note: note || null,
      },
      include: {
        productTemplate: {
          select: {
            id: true,
            code: true,
            name: true,
            productQuality: true,
            styleTags: true,
          },
        },
      },
    });

    return NextResponse.json({ item });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'This product is already in the studio' },
        { status: 400 }
      );
    }
    console.error('Error creating design studio item:', err);
    return NextResponse.json(
      { error: 'Failed to create design studio item', details: err.message },
      { status: 500 }
    );
  }
}
