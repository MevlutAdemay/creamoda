/**
 * Equipment Catalog API (single)
 * PATCH: Update equipment catalog item
 * DELETE: Delete equipment catalog item
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
      code,
      name,
      allowedBuildingRole,
      purchaseCostMoney,
      monthlyMaintenanceCost,
      effects,
    } = body;

    // Build update data
    const updateData: any = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (allowedBuildingRole !== undefined) updateData.allowedBuildingRole = allowedBuildingRole || null;
    if (purchaseCostMoney !== undefined) {
      if (purchaseCostMoney < 0) {
        return NextResponse.json(
          { error: 'purchaseCostMoney must be non-negative' },
          { status: 400 }
        );
      }
      updateData.purchaseCostMoney = purchaseCostMoney;
    }
    if (monthlyMaintenanceCost !== undefined) {
      if (monthlyMaintenanceCost < 0) {
        return NextResponse.json(
          { error: 'monthlyMaintenanceCost must be non-negative' },
          { status: 400 }
        );
      }
      updateData.monthlyMaintenanceCost = monthlyMaintenanceCost;
    }
    if (effects !== undefined) updateData.effects = effects || null;

    const equipment = await prisma.equipmentCatalog.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(equipment);
  } catch (error: any) {
    console.error('Error updating equipment catalog item:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An equipment with this code already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update equipment catalog item', details: error.message },
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

    // Check if equipment is used in requirement rules
    const requirementEquipments = await prisma.requirementEquipment.findFirst({
      where: { equipmentId: id },
    });

    if (requirementEquipments) {
      return NextResponse.json(
        { error: 'Cannot delete equipment that is used in requirement rules' },
        { status: 400 }
      );
    }

    await prisma.equipmentCatalog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting equipment catalog item:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete equipment catalog item', details: error.message },
      { status: 500 }
    );
  }
}
