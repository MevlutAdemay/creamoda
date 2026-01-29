/**
 * Requirement Rule API (single)
 * PATCH: Update requirement rule
 * DELETE: Delete requirement rule
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
      buildingRole,
      metricType,
      level,
      requiresStaffingComplete,
      equipmentRequirements,
      effects,
    } = body;

    // Build update data
    const updateData: any = {};
    if (buildingRole !== undefined) updateData.buildingRole = buildingRole;
    if (metricType !== undefined) updateData.metricType = metricType;
    if (level !== undefined) {
      if (level < 1) {
        return NextResponse.json(
          { error: 'Level must be at least 1' },
          { status: 400 }
        );
      }
      updateData.level = level;
    }
    if (requiresStaffingComplete !== undefined) updateData.requiresStaffingComplete = requiresStaffingComplete;
    if (effects !== undefined) updateData.effects = effects || null;

    // Handle equipment requirements update
    if (equipmentRequirements !== undefined) {
      // Delete existing equipment requirements
      await prisma.requirementEquipment.deleteMany({
        where: { ruleId: id },
      });

      // Create new ones if provided
      if (Array.isArray(equipmentRequirements) && equipmentRequirements.length > 0) {
        // Validate equipment requirements
        for (const eqReq of equipmentRequirements) {
          if (!eqReq.equipmentId || eqReq.requiredQuantity === undefined) {
            return NextResponse.json(
              { error: 'Each equipment requirement must have equipmentId and requiredQuantity' },
              { status: 400 }
            );
          }
          if (eqReq.requiredQuantity < 1) {
            return NextResponse.json(
              { error: 'requiredQuantity must be at least 1' },
              { status: 400 }
            );
          }
          // Verify equipment exists
          const equipment = await prisma.equipmentCatalog.findUnique({
            where: { id: eqReq.equipmentId },
          });
          if (!equipment) {
            return NextResponse.json(
              { error: `Equipment with id ${eqReq.equipmentId} not found` },
              { status: 404 }
            );
          }
        }

        updateData.equipmentRequirements = {
          create: equipmentRequirements.map((eqReq: any) => ({
            equipmentId: eqReq.equipmentId,
            requiredQuantity: eqReq.requiredQuantity,
          })),
        };
      }
    }

    const rule = await prisma.requirementRule.update({
      where: { id },
      data: updateData,
      include: {
        equipmentRequirements: {
          include: {
            equipment: true,
          },
        },
      },
    });

    return NextResponse.json(rule);
  } catch (error: any) {
    console.error('Error updating requirement rule:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A rule with this buildingRole, metricType, and level already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update requirement rule', details: error.message },
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

    // Equipment requirements will be deleted via cascade
    await prisma.requirementRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting requirement rule:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete requirement rule', details: error.message },
      { status: 500 }
    );
  }
}
