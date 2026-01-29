/**
 * Equipment Catalog API
 * GET: List all equipment catalog items
 * POST: Create a new equipment catalog item
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { BuildingRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const allowedBuildingRole = searchParams.get('allowedBuildingRole') as BuildingRole | null;

    const where: any = {};
    if (allowedBuildingRole) where.allowedBuildingRole = allowedBuildingRole;

    const equipment = await prisma.equipmentCatalog.findMany({
      where,
      orderBy: [
        { code: 'asc' },
      ],
    });

    return NextResponse.json({ equipment });
  } catch (error: any) {
    console.error('Error fetching equipment catalog:', error);
    return NextResponse.json(
      { error: 'Failed to fetch equipment catalog', details: error.message },
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
      code,
      name,
      allowedBuildingRole,
      purchaseCostMoney,
      monthlyMaintenanceCost,
      effects,
    } = body;

    // Validation
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name' },
        { status: 400 }
      );
    }

    if (purchaseCostMoney !== undefined && purchaseCostMoney < 0) {
      return NextResponse.json(
        { error: 'purchaseCostMoney must be non-negative' },
        { status: 400 }
      );
    }

    if (monthlyMaintenanceCost !== undefined && monthlyMaintenanceCost < 0) {
      return NextResponse.json(
        { error: 'monthlyMaintenanceCost must be non-negative' },
        { status: 400 }
      );
    }

    const equipment = await prisma.equipmentCatalog.create({
      data: {
        code,
        name,
        allowedBuildingRole: allowedBuildingRole || null,
        purchaseCostMoney: purchaseCostMoney ?? 0,
        monthlyMaintenanceCost: monthlyMaintenanceCost ?? 0,
        effects: effects || null,
      },
    });

    return NextResponse.json(equipment, { status: 201 });
  } catch (error: any) {
    console.error('Error creating equipment catalog item:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An equipment with this code already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create equipment catalog item', details: error.message },
      { status: 500 }
    );
  }
}
