/**
 * Economy Config API (single)
 * PATCH: Update economy config
 * DELETE: Delete economy config
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
      upgradeCostMoney,
      awardXpOnUpgrade,
      areaM2,
      rentPerMonthly,
      overheadMonthly,
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
    if (upgradeCostMoney !== undefined) {
      if (upgradeCostMoney < 0) {
        return NextResponse.json(
          { error: 'upgradeCostMoney must be non-negative' },
          { status: 400 }
        );
      }
      updateData.upgradeCostMoney = upgradeCostMoney;
    }
    if (awardXpOnUpgrade !== undefined) updateData.awardXpOnUpgrade = awardXpOnUpgrade;
    if (areaM2 !== undefined) updateData.areaM2 = areaM2;
    if (rentPerMonthly !== undefined) updateData.rentPerMonthly = rentPerMonthly || null;
    if (overheadMonthly !== undefined) updateData.overheadMonthly = overheadMonthly || null;
    if (effects !== undefined) updateData.effects = effects || null;

    const config = await prisma.economyConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Error updating economy config:', error);
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
      { error: 'Failed to update economy config', details: error.message },
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

    await prisma.economyConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting economy config:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete economy config', details: error.message },
      { status: 500 }
    );
  }
}
