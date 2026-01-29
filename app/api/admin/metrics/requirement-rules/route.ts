/**
 * Requirement Rule API
 * GET: List all requirement rules
 * POST: Create a new requirement rule
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { BuildingRole, MetricType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const buildingRole = searchParams.get('buildingRole') as BuildingRole | null;
    const metricType = searchParams.get('metricType') as MetricType | null;

    const where: any = {};
    if (buildingRole) where.buildingRole = buildingRole;
    if (metricType) where.metricType = metricType;

    const rules = await prisma.requirementRule.findMany({
      where,
      include: {
        equipmentRequirements: {
          include: {
            equipment: true,
          },
        },
      },
      orderBy: [
        { buildingRole: 'asc' },
        { metricType: 'asc' },
        { level: 'asc' },
      ],
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('Error fetching requirement rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requirement rules', details: error.message },
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
      requiresStaffingComplete,
      equipmentRequirements,
      effects,
    } = body;

    // Validation
    if (!buildingRole || !metricType || level === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: buildingRole, metricType, level' },
        { status: 400 }
      );
    }

    if (level < 1) {
      return NextResponse.json(
        { error: 'Level must be at least 1' },
        { status: 400 }
      );
    }

    // Validate equipment requirements if provided
    if (equipmentRequirements && Array.isArray(equipmentRequirements)) {
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
    }

    // Create rule with equipment requirements
    const rule = await prisma.requirementRule.create({
      data: {
        buildingRole,
        metricType,
        level,
        requiresStaffingComplete: requiresStaffingComplete ?? true,
        effects: effects || null,
        equipmentRequirements: equipmentRequirements && equipmentRequirements.length > 0
          ? {
              create: equipmentRequirements.map((eqReq: any) => ({
                equipmentId: eqReq.equipmentId,
                requiredQuantity: eqReq.requiredQuantity,
              })),
            }
          : undefined,
      },
      include: {
        equipmentRequirements: {
          include: {
            equipment: true,
          },
        },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    console.error('Error creating requirement rule:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A rule with this buildingRole, metricType, and level already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create requirement rule', details: error.message },
      { status: 500 }
    );
  }
}
