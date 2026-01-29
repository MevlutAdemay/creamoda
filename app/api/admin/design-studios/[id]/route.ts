// app/api/admin/design-studios/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { ProductSeason, StyleTag, ProductQuality, StudioStatus } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const updateData: any = {};
    if (body.code !== undefined) updateData.code = body.code;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.shortPitch !== undefined) updateData.shortPitch = body.shortPitch || null;
    if (body.productSeason !== undefined) updateData.productSeason = body.productSeason as ProductSeason;
    if (body.styleTag !== undefined) updateData.styleTag = body.styleTag as StyleTag;
    if (body.quality !== undefined) updateData.quality = body.quality as ProductQuality;
    if (body.status !== undefined) updateData.status = body.status as StudioStatus;
    if (body.coverImageUrl !== undefined) updateData.coverImageUrl = body.coverImageUrl;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    // Check code uniqueness if code is being updated
    if (body.code !== undefined) {
      const existing = await prisma.designStudio.findFirst({
        where: {
          code: body.code,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Design studio with this code already exists' },
          { status: 400 }
        );
      }
    }

    const studio = await prisma.designStudio.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json({ studio });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Design studio not found' }, { status: 404 });
    }
    console.error('Error updating design studio:', err);
    return NextResponse.json(
      { error: 'Failed to update design studio', details: err.message },
      { status: 500 }
    );
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

    await prisma.designStudio.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Design studio not found' }, { status: 404 });
    }
    console.error('Error deleting design studio:', err);
    return NextResponse.json(
      { error: 'Failed to delete design studio', details: err.message },
      { status: 500 }
    );
  }
}
