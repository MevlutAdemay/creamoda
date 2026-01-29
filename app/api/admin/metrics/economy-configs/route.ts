/**
 * Economy Config API
 * GET: List all economy configs
 * POST: Create a new economy config
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

    const configs = await prisma.economyConfig.findMany({
      where,
      orderBy: [
        { buildingRole: 'asc' },
        { metricType: 'asc' },
        { level: 'asc' },
      ],
    });

    return NextResponse.json({ configs });
  } catch (error: any) {
    console.error('Error fetching economy configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch economy configs', details: error.message },
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
      upgradeCostMoney,
      awardXpOnUpgrade,
      areaM2,
      rentPerMonthly,
      overheadMonthly,
      effects,
    } = body;

    // Validation
    if (!buildingRole || !metricType || level === undefined || upgradeCostMoney === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: buildingRole, metricType, level, upgradeCostMoney' },
        { status: 400 }
      );
    }

    if (level < 1) {
      return NextResponse.json(
        { error: 'Level must be at least 1' },
        { status: 400 }
      );
    }

    if (upgradeCostMoney < 0) {
      return NextResponse.json(
        { error: 'upgradeCostMoney must be non-negative' },
        { status: 400 }
      );
    }

    const config = await prisma.economyConfig.create({
      data: {
        buildingRole,
        metricType,
        level,
        upgradeCostMoney,
        awardXpOnUpgrade: awardXpOnUpgrade ?? 0,
        areaM2: areaM2 ?? 0,
        rentPerMonthly: rentPerMonthly || null,
        overheadMonthly: overheadMonthly || null,
        effects: effects || null,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error: any) {
    console.error('Error creating economy config:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A config with this buildingRole, metricType, and level already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create economy config', details: error.message },
      { status: 500 }
    );
  }
}
