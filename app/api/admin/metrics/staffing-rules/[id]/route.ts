// app/api/admin/metrics/staffing-rules/[id]/route.ts
/**
 * Staffing Rule API (single)
 * PATCH: Update staffing rule
 * DELETE: Delete staffing rule
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { StaffRoleStyle } from '@prisma/client';

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
      departmentCode,
      roleStyle,
      roleCode,
      roleName,
      deltaHeadcount,
      baseMonthlySalary,
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
    if (departmentCode !== undefined) updateData.departmentCode = departmentCode;
    if (roleStyle !== undefined) {
      if (!Object.values(StaffRoleStyle).includes(roleStyle)) {
        return NextResponse.json(
          { error: `Invalid roleStyle. Must be one of: ${Object.values(StaffRoleStyle).join(', ')}` },
          { status: 400 }
        );
      }
      updateData.roleStyle = roleStyle;
    }
    if (roleCode !== undefined) {
      if (roleCode.length > 40) {
        return NextResponse.json(
          { error: 'roleCode must be 40 characters or less' },
          { status: 400 }
        );
      }
      updateData.roleCode = roleCode;
    }
    if (roleName !== undefined) {
      if (roleName.length > 120) {
        return NextResponse.json(
          { error: 'roleName must be 120 characters or less' },
          { status: 400 }
        );
      }
      updateData.roleName = roleName;
    }
    if (deltaHeadcount !== undefined) updateData.deltaHeadcount = deltaHeadcount;
    if (baseMonthlySalary !== undefined) {
      const salary = parseFloat(baseMonthlySalary);
      if (isNaN(salary) || salary < 0) {
        return NextResponse.json(
          { error: 'baseMonthlySalary must be a valid positive number' },
          { status: 400 }
        );
      }
      updateData.baseMonthlySalary = salary;
    }
    if (effects !== undefined) updateData.effects = effects || null;

    const rule = await prisma.staffingRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(rule);
  } catch (error: any) {
    console.error('Error updating staffing rule:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A rule with this buildingRole, metricType, level, departmentCode, and roleCode already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update staffing rule', details: error.message },
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

    await prisma.staffingRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting staffing rule:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete staffing rule', details: error.message },
      { status: 500 }
    );
  }
}
