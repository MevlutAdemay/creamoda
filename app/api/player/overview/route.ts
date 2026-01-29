// app/api/player/overview/route.ts
/**
 * Get player overview data: Company, Buildings, and Staff
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's company with related data
    const company = await prisma.company.findFirst({
      where: { playerId: userId },
      select: {
        id: true,
        name: true,
        country: {
          select: {
            id: true,
            name: true,
            iso2: true,
            marketZone: true,
          },
        },
        city: {
          select: {
            id: true,
            name: true,
          },
        },
        buildings: {
          select: {
            id: true,
            name: true,
            role: true,
            marketZone: true,
            createdAt: true,
          },
          orderBy: {
            role: 'asc',
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get all active staff for this company
    const staff = await prisma.companyStaff.findMany({
      where: {
        companyId: company.id,
        firedAt: null, // Only active staff
      },
      select: {
        id: true,
        fullName: true,
        gender: true,
        departmentCode: true,
        roleCode: true,
        roleName: true,
        roleStyle: true,
        monthlySalaryFinal: true,
        hiredAt: true,
        buildingId: true,
        // @ts-expect-error - Prisma types are stale, country relation exists in schema
        building: {
          select: {
            id: true,
            name: true,
            role: true,
            country: {
              select: {
                id: true,
                iso2: true,
              },
            },
          },
        },
      },
      orderBy: [
        { building: { role: 'asc' } },
        { departmentCode: 'asc' },
        { roleCode: 'asc' },
        { fullName: 'asc' },
      ],
    });

    // Calculate staff statistics
    const staffStats = {
      total: staff.length,
      byBuilding: company.buildings.map((building) => ({
        buildingId: building.id,
        buildingName: building.name,
        buildingRole: building.role,
        count: staff.filter((s) => s.building?.id === building.id).length,
      })),
      totalMonthlySalary: staff.reduce(
        (sum, s) => sum + s.monthlySalaryFinal.toNumber(),
        0
      ),
    };

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        country: company.country,
        city: company.city,
      },
      buildings: company.buildings,
      staff: staff.map((s) => {
        const building = s.building;
        return {
          id: s.id,
          fullName: s.fullName,
          gender: s.gender,
          departmentCode: s.departmentCode,
          roleCode: s.roleCode,
          roleName: s.roleName,
          roleStyle: s.roleStyle,
          monthlySalary: s.monthlySalaryFinal.toNumber(),
          hiredAt: s.hiredAt.toISOString(),
          building: building
            ? {
                id: building.id,
                name: building.name,
                role: building.role,
                country: building.country
                  ? {
                      id: building.country.id,
                      iso2: building.country.iso2,
                    }
                  : null,
              }
            : null,
        };
      }),
      stats: staffStats,
    });
  } catch (error) {
    console.error('Error fetching player overview:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch overview',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
