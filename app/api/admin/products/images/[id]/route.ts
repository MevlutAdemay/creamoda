/**
 * Product Image API (single)
 * PATCH: Update image (slot, unlockType, sortOrder, alt only - url stays)
 * DELETE: Delete image record (does NOT delete blob)
 */

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
    const {
      slot,
      unlockType,
      unlockCostXp,
      unlockCostDiamond,
      sortOrder,
      alt,
    } = body;

    // Build update data (url and meta are NOT updatable via this endpoint)
    const updateData: any = {};
    if (slot !== undefined) updateData.slot = slot;
    if (unlockType !== undefined) updateData.unlockType = unlockType;
    if (unlockCostXp !== undefined) updateData.unlockCostXp = unlockCostXp || null;
    if (unlockCostDiamond !== undefined) updateData.unlockCostDiamond = unlockCostDiamond || null;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (alt !== undefined) updateData.alt = alt || null;

    const image = await prisma.productImageTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(image);
  } catch (error: any) {
    console.error('Error updating image:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update image', details: error.message },
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

    // Note: We do NOT delete the blob file, only the DB record
    await prisma.productImageTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting image:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete image', details: error.message },
      { status: 500 }
    );
  }
}
