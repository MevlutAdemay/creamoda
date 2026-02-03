// app/api/player/warehouse/new/preview/route.ts

/**
 * Preview for adding a new WAREHOUSE.
 * GET ?countryId=...&marketZone=...
 * Returns: staff (WAREHOUSE level 1), equipment, setup costs, total cost, wallet balance, after balance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, MarketZone, MetricType } from '@prisma/client';
import { getBuildingSetupCosts } from '@/lib/buildings/init-building-metrics';

type StaffPosition = {
  departmentCode: string;
  roleCode: string;
  roleName: string;
  roleStyle: string;
  headcount: number;
  monthlySalary: number;
};

type Equipment = {
  code: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
};

type SetupCost = {
  metricType: MetricType;
  cost: number;
  description: string;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get('countryId');
    const marketZone = searchParams.get('marketZone') as MarketZone | null;

    if (!countryId || !marketZone) {
      return NextResponse.json(
        { error: 'countryId and marketZone are required' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    const company = await prisma.company.findFirst({
      where: { playerId: userId },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const existing = await prisma.companyBuilding.findFirst({
      where: {
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
        marketZone,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Warehouse already exists for this market zone', existingMarketZone: marketZone },
        { status: 409 }
      );
    }

    const country = await prisma.country.findUnique({
      where: { id: countryId },
      select: { name: true, salaryMultiplier: true },
    });
    if (!country) {
      return NextResponse.json({ error: 'Country not found' }, { status: 400 });
    }
    const salaryMultiplier = country.salaryMultiplier?.toNumber() ?? 1.0;

    const staffingRules = await prisma.staffingRule.findMany({
      where: { buildingRole: BuildingRole.WAREHOUSE, level: 1 },
      select: {
        departmentCode: true,
        roleCode: true,
        roleName: true,
        roleStyle: true,
        deltaHeadcount: true,
        baseMonthlySalary: true,
      },
      orderBy: [{ departmentCode: 'asc' }, { roleStyle: 'asc' }],
    });

    const staff: StaffPosition[] = staffingRules.map((rule) => ({
      departmentCode: rule.departmentCode,
      roleCode: rule.roleCode,
      roleName: rule.roleName,
      roleStyle: rule.roleStyle,
      headcount: rule.deltaHeadcount,
      monthlySalary: Math.round(rule.baseMonthlySalary.toNumber() * salaryMultiplier * 100) / 100,
    }));

    const requirementRules = await prisma.requirementRule.findMany({
      where: { buildingRole: BuildingRole.WAREHOUSE, level: 1 },
      select: {
        equipmentRequirements: {
          select: {
            requiredQuantity: true,
            equipment: {
              select: {
                code: true,
                name: true,
                purchaseCostMoney: true,
              },
            },
          },
        },
      },
    });

    const equipmentMap = new Map<string, Equipment>();
    for (const rule of requirementRules) {
      for (const req of rule.equipmentRequirements) {
        const unitCost = req.equipment.purchaseCostMoney.toNumber();
        const quantity = req.requiredQuantity;
        const key = req.equipment.code;
        const existingEq = equipmentMap.get(key);
        if (existingEq) {
          existingEq.quantity = Math.max(existingEq.quantity, quantity);
          existingEq.totalCost = existingEq.quantity * existingEq.unitCost;
        } else {
          equipmentMap.set(key, {
            code: req.equipment.code,
            name: req.equipment.name,
            quantity,
            unitCost,
            totalCost: quantity * unitCost,
          });
        }
      }
    }
    const equipment = Array.from(equipmentMap.values());

    const setupCostConfigs = await getBuildingSetupCosts(prisma, BuildingRole.WAREHOUSE);
    const setupCosts: SetupCost[] = setupCostConfigs
      .filter((c) => !c.upgradeCostMoney.isZero())
      .map((c) => ({
        metricType: c.metricType,
        cost: c.upgradeCostMoney.toNumber(),
        description: `Level 1 ${c.metricType} initialization`,
      }));

    const equipmentTotal = equipment.reduce((sum, e) => sum + e.totalCost, 0);
    const setupTotal = setupCosts.reduce((sum, s) => s.cost, 0);
    const totalSetupCost = equipmentTotal + setupTotal;
    const monthlyPayroll = staff.reduce((sum, p) => sum + p.monthlySalary * p.headcount, 0);

    const wallet = await prisma.playerWallet.findUnique({
      where: { userId },
      select: { balanceUsd: true },
    });
    const currentBalance = wallet?.balanceUsd.toNumber() ?? 0;
    const afterSetup = currentBalance - totalSetupCost;

    return NextResponse.json({
      countryId,
      countryName: country.name,
      marketZone,
      staff,
      equipment,
      setupCosts,
      costs: {
        equipmentTotal: Math.round(equipmentTotal * 100) / 100,
        setupTotal: Math.round(setupTotal * 100) / 100,
        totalSetupCost: Math.round(totalSetupCost * 100) / 100,
        monthlyPayroll: Math.round(monthlyPayroll * 100) / 100,
      },
      wallet: {
        currentBalance: Math.round(currentBalance * 100) / 100,
        afterSetup: Math.round(afterSetup * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error in warehouse new preview:', error);
    return NextResponse.json(
      { error: 'Failed to load preview', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
