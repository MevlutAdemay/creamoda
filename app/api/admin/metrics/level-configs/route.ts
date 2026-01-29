/**
 * Metric Level Config API
 * GET: List all metric level configs
 * POST: Create a new metric level config
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

    const configs = await prisma.metricLevelConfig.findMany({
      where,
      orderBy: [
        { buildingRole: 'asc' },
        { metricType: 'asc' },
        { level: 'asc' },
      ],
    });

    return NextResponse.json({ configs });
  } catch (error: any) {
    console.error('Error fetching metric level configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metric level configs', details: error.message },
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
      minRequired,
      maxAllowed,
      effects,
    } = body;

    // Validation
    if (!buildingRole || !metricType || level === undefined || maxAllowed === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: buildingRole, metricType, level, maxAllowed' },
        { status: 400 }
      );
    }

    if (level < 1) {
      return NextResponse.json(
        { error: 'Level must be at least 1' },
        { status: 400 }
      );
    }

    if (minRequired !== undefined && minRequired < 0) {
      return NextResponse.json(
        { error: 'minRequired must be non-negative' },
        { status: 400 }
      );
    }

    if (maxAllowed < 0) {
      return NextResponse.json(
        { error: 'maxAllowed must be non-negative' },
        { status: 400 }
      );
    }

    if (minRequired !== undefined && maxAllowed < minRequired) {
      return NextResponse.json(
        { error: 'maxAllowed must be >= minRequired' },
        { status: 400 }
      );
    }

    const config = await prisma.metricLevelConfig.create({
      data: {
        buildingRole,
        metricType,
        level,
        minRequired: minRequired ?? 0,
        maxAllowed,
        effects: effects || null,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error: any) {
    console.error('Error creating metric level config:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A config with this buildingRole, metricType, and level already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create metric level config', details: error.message },
      { status: 500 }
    );
  }
}
