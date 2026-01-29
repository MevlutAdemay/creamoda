/**
 * Staffing Rule API
 * GET: List all staffing rules
 * POST: Create a new staffing rule
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { BuildingRole, MetricType, DepartmentCode, StaffRoleStyle } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const buildingRole = searchParams.get('buildingRole') as BuildingRole | null;
    const metricType = searchParams.get('metricType') as MetricType | null;
    const level = searchParams.get('level') ? parseInt(searchParams.get('level')!) : null;

    const where: any = {};
    if (buildingRole) where.buildingRole = buildingRole;
    if (metricType) where.metricType = metricType;
    if (level !== null) where.level = level;

    const rules = await prisma.staffingRule.findMany({
      where,
      orderBy: [
        { buildingRole: 'asc' },
        { metricType: 'asc' },
        { level: 'asc' },
        { departmentCode: 'asc' },
      ],
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('Error fetching staffing rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staffing rules', details: error.message },
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

    // Validation
    if (!buildingRole || !metricType || level === undefined || !departmentCode || !roleStyle || !roleCode || !roleName || deltaHeadcount === undefined || baseMonthlySalary === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: buildingRole, metricType, level, departmentCode, roleStyle, roleCode, roleName, deltaHeadcount, baseMonthlySalary' },
        { status: 400 }
      );
    }

    // Validate roleStyle enum
    if (!Object.values(StaffRoleStyle).includes(roleStyle)) {
      return NextResponse.json(
        { error: `Invalid roleStyle. Must be one of: ${Object.values(StaffRoleStyle).join(', ')}` },
        { status: 400 }
      );
    }

    if (level < 1) {
      return NextResponse.json(
        { error: 'Level must be at least 1' },
        { status: 400 }
      );
    }

    if (roleCode.length > 40) {
      return NextResponse.json(
        { error: 'roleCode must be 40 characters or less' },
        { status: 400 }
      );
    }

    if (roleName.length > 120) {
      return NextResponse.json(
        { error: 'roleName must be 120 characters or less' },
        { status: 400 }
      );
    }

    // Validate baseMonthlySalary
    const salary = parseFloat(baseMonthlySalary);
    if (isNaN(salary) || salary < 0) {
      return NextResponse.json(
        { error: 'baseMonthlySalary must be a valid positive number' },
        { status: 400 }
      );
    }

    const rule = await prisma.staffingRule.create({
      data: {
        buildingRole,
        metricType,
        level,
        departmentCode,
        roleStyle,
        roleCode,
        roleName,
        deltaHeadcount,
        baseMonthlySalary: salary,
        effects: effects || null,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    console.error('Error creating staffing rule:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A rule with this buildingRole, metricType, level, departmentCode, and roleCode already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create staffing rule', details: error.message },
      { status: 500 }
    );
  }
}
