// app/api/wizard/preview/route.ts
/**
 * Wizard Step 2: Preview Setup
 * 
 * Returns preview data for confirmation:
 * - Staff positions from StaffingRule for BOTH HQ and WAREHOUSE at level=1
 * - Equipment from RequirementEquipment -> EquipmentCatalog for level=1
 * - Setup costs from EconomyConfig (NEW)
 * - Cost summary (equipment + setup costs + estimated monthly payroll)
 * - XP award
 * - Current wallet balance
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, MetricType } from '@prisma/client';
import { getCompanyBuildings } from '@/lib/company/ensure-company-buildings';

// Constants
const WIZARD_XP_AWARD = 500; // XP awarded for completing wizard

// Types for response
type StaffPosition = {
  buildingRole: BuildingRole;
  departmentCode: string;
  roleCode: string;
  roleName: string;
  roleStyle: string;
  headcount: number;
  monthlySalary: number;
};

type Equipment = {
  buildingRole: BuildingRole;
  code: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
};

type SetupCost = {
  buildingRole: BuildingRole;
  metricType: MetricType;
  cost: number;
  description: string;
};

export async function GET() {
  try {
    // 1. Auth check
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Get user's company with buildings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        companies: {
          take: 1,
          select: {
            id: true,
            name: true,
            country: { select: { name: true, salaryMultiplier: true, marketZone: true } },
            city: { select: { name: true } },
          },
        },
      },
    });

    if (!user?.companies?.[0]) {
      return NextResponse.json(
        { error: 'No company found. Please complete Step 1 first.' },
        { status: 400 }
      );
    }

    const company = user.companies[0];
    const salaryMultiplier = company.country.salaryMultiplier?.toNumber() || 1.0;

    // 3. Verify buildings exist
    const { hqBuilding, warehouseBuilding } = await getCompanyBuildings(prisma, company.id);

    if (!hqBuilding || !warehouseBuilding) {
      return NextResponse.json(
        { error: 'Company buildings not found. Please refresh and try again.' },
        { status: 400 }
      );
    }

    // 4. Get Level 1 staff requirements for BOTH HQ and WAREHOUSE
    const staffingRules = await prisma.staffingRule.findMany({
      where: {
        buildingRole: { in: [BuildingRole.HQ, BuildingRole.WAREHOUSE] },
        level: 1,
      },
      select: {
        buildingRole: true,
        departmentCode: true,
        roleCode: true,
        roleName: true,
        roleStyle: true,
        deltaHeadcount: true,
        baseMonthlySalary: true,
      },
      orderBy: [
        { buildingRole: 'asc' },
        { departmentCode: 'asc' },
        { roleStyle: 'asc' },
      ],
    });

    // Transform to preview format with salary multiplier applied
    const staffPositions: StaffPosition[] = staffingRules.map((rule) => {
      const baseSalary = rule.baseMonthlySalary.toNumber();
      const adjustedSalary = baseSalary * salaryMultiplier;
      return {
        buildingRole: rule.buildingRole,
        departmentCode: rule.departmentCode,
        roleCode: rule.roleCode,
        roleName: rule.roleName,
        roleStyle: rule.roleStyle,
        headcount: rule.deltaHeadcount,
        monthlySalary: Math.round(adjustedSalary * 100) / 100,
      };
    });

    // Group staff by building role for UI
    const hqStaff = staffPositions.filter((s) => s.buildingRole === BuildingRole.HQ);
    const warehouseStaff = staffPositions.filter((s) => s.buildingRole === BuildingRole.WAREHOUSE);

    // 5. Get Level 1 equipment requirements for BOTH HQ and WAREHOUSE
    const requirementRules = await prisma.requirementRule.findMany({
      where: {
        buildingRole: { in: [BuildingRole.HQ, BuildingRole.WAREHOUSE] },
        level: 1,
      },
      select: {
        buildingRole: true,
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
    });

    // Aggregate equipment requirements by buildingRole
    const equipmentMap = new Map<string, Equipment>();

    for (const rule of requirementRules) {
      for (const req of rule.equipmentRequirements) {
        // Key includes buildingRole to separate HQ vs WAREHOUSE equipment
        const key = `${rule.buildingRole}:${req.equipment.id}`;
        const existing = equipmentMap.get(key);
        const unitCost = req.equipment.purchaseCostMoney.toNumber();
        const quantity = req.requiredQuantity;

        if (existing) {
          // Take max quantity if same equipment appears multiple times
          existing.quantity = Math.max(existing.quantity, quantity);
          existing.totalCost = existing.quantity * existing.unitCost;
        } else {
          equipmentMap.set(key, {
            buildingRole: rule.buildingRole,
            code: req.equipment.code,
            name: req.equipment.name,
            quantity,
            unitCost,
            totalCost: quantity * unitCost,
          });
        }
      }
    }

    const allEquipment = Array.from(equipmentMap.values());

    // Group equipment by building role for UI
    const hqEquipment = allEquipment.filter((e) => e.buildingRole === BuildingRole.HQ);
    const warehouseEquipment = allEquipment.filter((e) => e.buildingRole === BuildingRole.WAREHOUSE);

    // 6. Get EconomyConfig setup costs for Level 1 (NEW)
    const economyConfigs = await prisma.economyConfig.findMany({
      where: {
        buildingRole: { in: [BuildingRole.HQ, BuildingRole.WAREHOUSE] },
        level: 1,
      },
      select: {
        buildingRole: true,
        metricType: true,
        upgradeCostMoney: true,
      },
    });

    // Transform to setup costs
    const setupCosts: SetupCost[] = economyConfigs
      .filter((ec) => !ec.upgradeCostMoney.isZero())
      .map((ec) => ({
        buildingRole: ec.buildingRole,
        metricType: ec.metricType,
        cost: ec.upgradeCostMoney.toNumber(),
        description: `Level 1 ${ec.metricType} initialization`,
      }));

    // Group setup costs by building role
    const hqSetupCosts = setupCosts.filter((s) => s.buildingRole === BuildingRole.HQ);
    const warehouseSetupCosts = setupCosts.filter((s) => s.buildingRole === BuildingRole.WAREHOUSE);

    // 7. Calculate costs
    const hqEquipmentTotal = hqEquipment.reduce((sum, eq) => sum + eq.totalCost, 0);
    const warehouseEquipmentTotal = warehouseEquipment.reduce((sum, eq) => sum + eq.totalCost, 0);
    const equipmentTotal = hqEquipmentTotal + warehouseEquipmentTotal;

    const hqSetupTotal = hqSetupCosts.reduce((sum, s) => sum + s.cost, 0);
    const warehouseSetupTotal = warehouseSetupCosts.reduce((sum, s) => sum + s.cost, 0);
    const setupTotal = hqSetupTotal + warehouseSetupTotal;

    const hqMonthlyPayroll = hqStaff.reduce(
      (sum, pos) => sum + pos.monthlySalary * pos.headcount,
      0
    );
    const warehouseMonthlyPayroll = warehouseStaff.reduce(
      (sum, pos) => sum + pos.monthlySalary * pos.headcount,
      0
    );
    const monthlyPayroll = hqMonthlyPayroll + warehouseMonthlyPayroll;

    // Total setup cost = equipment + setup costs (first payroll is a monthly obligation)
    const totalSetupCost = equipmentTotal + setupTotal;

    // 8. Get current wallet balance
    const wallet = await prisma.playerWallet.findUnique({
      where: { userId },
      select: { balanceUsd: true, balanceXp: true },
    });

    const currentBalance = wallet?.balanceUsd.toNumber() || 0;
    const afterSetup = currentBalance - totalSetupCost;

    // 9. Return preview data grouped by building
    return NextResponse.json({
      company: {
        name: company.name,
        country: company.country.name,
        city: company.city.name,
        marketZone: company.country.marketZone,
      },
      buildings: {
        hq: {
          id: hqBuilding.id,
          name: hqBuilding.name,
          role: hqBuilding.role,
        },
        warehouse: {
          id: warehouseBuilding.id,
          name: warehouseBuilding.name,
          role: warehouseBuilding.role,
          marketZone: warehouseBuilding.marketZone,
        },
      },
      staff: {
        hq: hqStaff,
        warehouse: warehouseStaff,
        totalHeadcount: staffPositions.reduce((sum, s) => sum + s.headcount, 0),
      },
      equipment: {
        hq: hqEquipment,
        warehouse: warehouseEquipment,
      },
      setupCosts: {
        hq: hqSetupCosts,
        warehouse: warehouseSetupCosts,
      },
      costs: {
        hqEquipmentTotal: Math.round(hqEquipmentTotal * 100) / 100,
        warehouseEquipmentTotal: Math.round(warehouseEquipmentTotal * 100) / 100,
        equipmentTotal: Math.round(equipmentTotal * 100) / 100,
        hqSetupTotal: Math.round(hqSetupTotal * 100) / 100,
        warehouseSetupTotal: Math.round(warehouseSetupTotal * 100) / 100,
        setupTotal: Math.round(setupTotal * 100) / 100,
        hqMonthlyPayroll: Math.round(hqMonthlyPayroll * 100) / 100,
        warehouseMonthlyPayroll: Math.round(warehouseMonthlyPayroll * 100) / 100,
        monthlyPayroll: Math.round(monthlyPayroll * 100) / 100,
        totalSetupCost: Math.round(totalSetupCost * 100) / 100,
      },
      rewards: {
        xpAward: WIZARD_XP_AWARD,
      },
      wallet: {
        currentBalance: Math.round(currentBalance * 100) / 100,
        currentXp: wallet?.balanceXp || 0,
        afterSetup: Math.round(afterSetup * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error fetching preview:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch preview',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
