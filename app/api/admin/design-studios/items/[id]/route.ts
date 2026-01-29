// app/api/admin/design-studios/items/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

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
    if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.note !== undefined) updateData.note = body.note;

    const item = await prisma.designStudioItem.update({
      where: { id },
      data: updateData,
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
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Design studio item not found' }, { status: 404 });
    }
    console.error('Error updating design studio item:', err);
    return NextResponse.json(
      { error: 'Failed to update design studio item', details: err.message },
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

    await prisma.designStudioItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Design studio item not found' }, { status: 404 });
    }
    console.error('Error deleting design studio item:', err);
    return NextResponse.json(
      { error: 'Failed to delete design studio item', details: err.message },
      { status: 500 }
    );
  }
}
