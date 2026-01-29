/**
 * Metric Level Config API (single)
 * PATCH: Update metric level config
 * DELETE: Delete metric level config
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
      minRequired,
      maxAllowed,
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
    if (minRequired !== undefined) {
      if (minRequired < 0) {
        return NextResponse.json(
          { error: 'minRequired must be non-negative' },
          { status: 400 }
        );
      }
      updateData.minRequired = minRequired;
    }
    if (maxAllowed !== undefined) {
      if (maxAllowed < 0) {
        return NextResponse.json(
          { error: 'maxAllowed must be non-negative' },
          { status: 400 }
        );
      }
      updateData.maxAllowed = maxAllowed;
    }
    if (effects !== undefined) updateData.effects = effects || null;

    // Validate minRequired <= maxAllowed if both are being updated
    if (updateData.minRequired !== undefined && updateData.maxAllowed !== undefined) {
      if (updateData.maxAllowed < updateData.minRequired) {
        return NextResponse.json(
          { error: 'maxAllowed must be >= minRequired' },
          { status: 400 }
        );
      }
    }

    const config = await prisma.metricLevelConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Error updating metric level config:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A config with this buildingRole, metricType, and level already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update metric level config', details: error.message },
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

    // Check if there are related building metric states
    const relatedStates = await prisma.buildingMetricState.findFirst({
      where: {
        // This would need to check if any building's metric state references this config
        // For now, we'll just delete it
      },
    });

    await prisma.metricLevelConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting metric level config:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete metric level config', details: error.message },
      { status: 500 }
    );
  }
}
