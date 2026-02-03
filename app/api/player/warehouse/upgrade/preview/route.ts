/**
 * GET /api/player/warehouse/upgrade/preview
 * Query: buildingId, metricType=STOCK_COUNT|SALES_COUNT
 * Read-only: returns upgrade requirements and costs for the next level.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, MetricType } from '@prisma/client';

const VALID_METRIC_TYPES: MetricType[] = [MetricType.STOCK_COUNT, MetricType.SALES_COUNT];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const metricTypeParam = searchParams.get('metricType');

    if (!buildingId || !metricTypeParam) {
      return NextResponse.json(
        { error: 'buildingId and metricType are required' },
        { status: 400 }
      );
    }

    const metricType = metricTypeParam as MetricType;
    if (!VALID_METRIC_TYPES.includes(metricType)) {
      return NextResponse.json(
        { error: 'metricType must be STOCK_COUNT or SALES_COUNT' },
        { status: 400 }
      );
    }

    const company = await prisma.company.findFirst({
      where: { playerId: session.user.id },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const building = await prisma.companyBuilding.findFirst({
      where: {
        id: buildingId,
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
      },
      select: {
        id: true,
        name: true,
        marketZone: true,
        countryId: true,
        country: {
          select: { id: true, salaryMultiplier: true },
        },
      },
    });

    if (!building) {
      return NextResponse.json(
        { error: 'Warehouse not found or does not belong to your company' },
        { status: 404 }
      );
    }

    const metricState = await prisma.buildingMetricState.findUnique({
      where: {
        buildingId_metricType: { buildingId, metricType },
      },
      select: { currentLevel: true, currentCount: true },
    });

    const currentLevel = metricState?.currentLevel ?? 1;
    const currentCount = metricState?.currentCount ?? 0;
    const targetLevel = currentLevel + 1;

    const [targetLevelConfig, economyConfig, staffingRules, requirementRule] = await Promise.all([
      prisma.metricLevelConfig.findUnique({
        where: {
          buildingRole_metricType_level: {
            buildingRole: BuildingRole.WAREHOUSE,
            metricType,
            level: targetLevel,
          },
        },
        select: { minRequired: true, maxAllowed: true },
      }),
      prisma.economyConfig.findUnique({
        where: {
          buildingRole_metricType_level: {
            buildingRole: BuildingRole.WAREHOUSE,
            metricType,
            level: targetLevel,
          },
        },
        select: {
          upgradeCostMoney: true,
          awardXpOnUpgrade: true,
          areaM2: true,
          rentPerMonthly: true,
          overheadMonthly: true,
        },
      }),
      prisma.staffingRule.findMany({
        where: {
          buildingRole: BuildingRole.WAREHOUSE,
          metricType,
          level: targetLevel,
        },
        select: {
          departmentCode: true,
          roleCode: true,
          roleName: true,
          roleStyle: true,
          deltaHeadcount: true,
          baseMonthlySalary: true,
        },
        orderBy: [{ departmentCode: 'asc' }, { roleCode: 'asc' }],
      }),
      prisma.requirementRule.findUnique({
        where: {
          buildingRole_metricType_level: {
            buildingRole: BuildingRole.WAREHOUSE,
            metricType,
            level: targetLevel,
          },
        },
        select: {
          equipmentRequirements: {
            select: {
              requiredQuantity: true,
              equipment: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  purchaseCostMoney: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const eligible = targetLevelConfig
      ? currentCount >= targetLevelConfig.minRequired
      : false;
    const ineligibleReason = targetLevelConfig && !eligible
      ? `Current count (${currentCount}) is below required (${targetLevelConfig.minRequired}) for level ${targetLevel}.`
      : !targetLevelConfig
        ? `No upgrade configuration for level ${targetLevel}.`
        : null;

    const salaryMultiplier = building.country?.salaryMultiplier
      ? Number(building.country.salaryMultiplier)
      : 1.0;

    const existingStaffByRole = await prisma.companyStaff.groupBy({
      by: ['roleCode'],
      where: {
        buildingId,
        metricType,
        firedAt: null,
      },
      _count: { id: true },
    });
    const staffCountByRole = new Map(
      existingStaffByRole.map((g) => [g.roleCode, g._count.id])
    );

    const staff = staffingRules.map((rule) => {
      const existing = staffCountByRole.get(rule.roleCode) ?? 0;
      const neededHeadcount = Math.max(rule.deltaHeadcount - existing, 0);
      const monthlySalaryEach =
        Math.round(Number(rule.baseMonthlySalary) * salaryMultiplier * 100) / 100;
      const monthlyTotal = Math.round(neededHeadcount * monthlySalaryEach * 100) / 100;
      return {
        departmentCode: rule.departmentCode,
        roleCode: rule.roleCode,
        roleName: rule.roleName,
        neededHeadcount,
        monthlySalaryEach,
        monthlyTotal,
      };
    });

    const equipmentRequirements =
      requirementRule?.equipmentRequirements ?? [];
    const equipmentIds = equipmentRequirements.map(
      (r) => r.equipment.id
    );
    const companyEquipment =
      equipmentIds.length > 0
        ? await prisma.companyEquipment.findMany({
            where: {
              companyId: company.id,
              equipmentId: { in: equipmentIds },
            },
            select: { equipmentId: true, quantity: true },
          })
        : [];
    const ownedByEquipmentId = new Map(
      companyEquipment.map((e) => [e.equipmentId, e.quantity])
    );

    const equipment = equipmentRequirements.map((req) => {
      const requiredQty = req.requiredQuantity;
      const ownedQty = ownedByEquipmentId.get(req.equipment.id) ?? 0;
      const neededQty = Math.max(requiredQty - ownedQty, 0);
      const unitCost = Number(req.equipment.purchaseCostMoney);
      const totalCost = Math.round(neededQty * unitCost * 100) / 100;
      return {
        code: req.equipment.code,
        name: req.equipment.name,
        neededQty,
        unitCost,
        totalCost,
      };
    });

    const upgradeCostMoney = economyConfig
      ? Number(economyConfig.upgradeCostMoney)
      : 0;
    const equipmentCostMoney = equipment.reduce(
      (sum, e) => sum + e.totalCost,
      0
    );
    const totalCostMoney = upgradeCostMoney + equipmentCostMoney;
    const payrollMonthlyDelta = staff.reduce(
      (sum, s) => sum + s.monthlyTotal,
      0
    );
    const awardXpOnUpgrade = economyConfig?.awardXpOnUpgrade ?? 0;

    return NextResponse.json({
      building: {
        id: building.id,
        name: building.name ?? null,
        marketZone: building.marketZone ?? null,
        countryId: building.countryId,
      },
      metricType,
      current: { level: currentLevel, count: currentCount },
      target: {
        level: targetLevel,
        minRequired: targetLevelConfig?.minRequired ?? null,
        maxAllowed: targetLevelConfig?.maxAllowed ?? null,
      },
      eligible,
      ineligibleReason: ineligibleReason ?? null,
      costs: {
        upgradeCostMoney,
        equipmentCostMoney,
        totalCostMoney,
        payrollMonthlyDelta,
      },
      staff,
      equipment,
      awardXpOnUpgrade,
    });
  } catch (err) {
    console.error('GET /api/player/warehouse/upgrade/preview error:', err);
    return NextResponse.json(
      { error: 'Failed to load upgrade preview' },
      { status: 500 }
    );
  }
}
