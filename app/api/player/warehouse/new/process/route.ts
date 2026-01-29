/**
 * Create a new WAREHOUSE building.
 * POST body: { countryId, cityId, marketZone }
 * Transaction: create building, init metrics, setup costs, staff, equipment, update wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import {
  BuildingRole,
  FinanceCategory,
  FinanceDirection,
  FinanceScopeType,
  FinanceCounterpartyType,
  StaffGender,
  CompanyBuilding,
  MetricType,
  MarketZone,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { createHash } from 'crypto';
import {
  generateIdempotencyKey,
  postLedgerEntry,
  PostLedgerEntryResult,
  updateWalletUsdFromLedgerBatch,
} from '@/lib/finance/helpers';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { getSeededStaffName } from '@/lib/staff/seeded-staff-name';
import { createWarehouseBuilding } from '@/lib/company/create-warehouse-building';
import { initBuildingMetrics, getBuildingSetupCosts } from '@/lib/buildings/init-building-metrics';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function postWarehouseSetupCosts(
  tx: TxClient,
  params: { companyId: string; buildingId: string; dayKey: Date }
): Promise<PostLedgerEntryResult[]> {
  const { companyId, buildingId, dayKey } = params;
  const results: PostLedgerEntryResult[] = [];
  const setupCosts = await getBuildingSetupCosts(tx, BuildingRole.WAREHOUSE);

  for (const cost of setupCosts) {
    if (cost.upgradeCostMoney.isZero()) continue;
    const idempotencyKey = generateIdempotencyKey(
      'WAREHOUSE_NEW:SETUP',
      companyId,
      buildingId,
      cost.metricType
    );
    const result = await postLedgerEntry(tx, {
      companyId,
      dayKey,
      direction: FinanceDirection.OUT,
      amountUsd: cost.upgradeCostMoney,
      category: FinanceCategory.CAPEX,
      scopeType: FinanceScopeType.BUILDING,
      scopeId: buildingId,
      counterpartyType: FinanceCounterpartyType.SYSTEM,
      refType: 'WAREHOUSE_SETUP',
      refId: buildingId,
      idempotencyKey,
      note: `New warehouse setup (${cost.metricType}): Level 1 initialization`,
    });
    results.push(result);
  }
  return results;
}

async function assignStaffForBuilding(
  tx: TxClient,
  params: {
    userId: string;
    companyId: string;
    building: CompanyBuilding;
    countryCode: string;
    salaryMultiplier: number;
    dayKey: Date;
  }
): Promise<{ maleCount: number; femaleCount: number }> {
  const { userId, companyId, building, countryCode, salaryMultiplier } = params;
  const buildingId = building.id;
  const buildingRole = building.role;

  const rules = await tx.staffingRule.findMany({
    where: { buildingRole, level: 1 },
    orderBy: [{ departmentCode: 'asc' }, { roleCode: 'asc' }],
  });

  let maleCount = 0;
  let femaleCount = 0;

  for (const rule of rules) {
    const existingCount = await tx.companyStaff.count({
      where: {
        companyId,
        buildingId,
        metricType: rule.metricType,
        level: 1,
        roleCode: rule.roleCode,
      },
    });
    const needed = rule.deltaHeadcount - existingCount;
    if (needed <= 0) continue;

    for (let i = 0; i < needed; i++) {
      const index = existingCount + i;
      const genderSeed = `${userId}:${companyId}:${buildingRole}:${rule.roleCode}:${index}`;
      const hash = createHash('sha256').update(genderSeed).digest();
      const genderValue = hash.readUInt32BE(0) % 2;
      const requestedGender: StaffGender = genderValue === 0 ? StaffGender.MALE : StaffGender.FEMALE;

      let name: { firstName: string; lastName: string; gender: StaffGender };
      try {
        name = await getSeededStaffName(tx, {
          countryCode,
          gender: requestedGender,
          userId,
          companyId,
          roleCode: `${buildingRole}:${rule.roleCode}`,
          index,
        });
      } catch {
        name = {
          firstName: requestedGender === StaffGender.FEMALE ? 'Jane' : 'John',
          lastName: 'Doe',
          gender: requestedGender,
        };
      }

      if (name.gender === StaffGender.MALE) maleCount++;
      else femaleCount++;

      const finalSalary = rule.baseMonthlySalary.mul(new Decimal(salaryMultiplier));
      await tx.companyStaff.create({
        data: {
          companyId,
          buildingId,
          metricType: rule.metricType,
          level: 1,
          departmentCode: rule.departmentCode,
          roleCode: rule.roleCode,
          roleName: rule.roleName,
          roleStyle: rule.roleStyle,
          fullName: `${name.firstName} ${name.lastName}`,
          gender: name.gender,
          baseMonthlySalary: rule.baseMonthlySalary,
          baseCurrencyCode: 'USD',
          salaryMultiplierApplied: new Decimal(salaryMultiplier),
          monthlySalaryFinal: finalSalary,
          hiredAt: params.dayKey,
        },
      });
    }
  }

  const activeCount = await tx.companyStaff.count({
    where: { buildingId, firedAt: null },
  });
  await tx.buildingMetricState.upsert({
    where: {
      buildingId_metricType: { buildingId, metricType: MetricType.EMPLOYEE_COUNT },
    },
    create: {
      buildingId,
      metricType: MetricType.EMPLOYEE_COUNT,
      currentLevel: 1,
      currentCount: activeCount,
      lastEvaluatedAt: new Date(),
    },
    update: { currentCount: activeCount, lastEvaluatedAt: new Date() },
  });

  return { maleCount, femaleCount };
}

async function assignEquipmentForBuilding(
  tx: TxClient,
  params: { companyId: string; buildingId: string; dayKey: Date }
): Promise<PostLedgerEntryResult[]> {
  const { companyId, buildingId, dayKey } = params;
  const results: PostLedgerEntryResult[] = [];

  const requirementRules = await tx.requirementRule.findMany({
    where: { buildingRole: BuildingRole.WAREHOUSE, level: 1 },
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
  });

  const equipmentMap = new Map<
    string,
    { equipmentId: string; code: string; requiredQuantity: number; purchaseCost: Decimal }
  >();
  for (const rule of requirementRules) {
    for (const req of rule.equipmentRequirements) {
      const existing = equipmentMap.get(req.equipment.id);
      if (existing) {
        existing.requiredQuantity = Math.max(existing.requiredQuantity, req.requiredQuantity);
      } else {
        equipmentMap.set(req.equipment.id, {
          equipmentId: req.equipment.id,
          code: req.equipment.code,
          requiredQuantity: req.requiredQuantity,
          purchaseCost: req.equipment.purchaseCostMoney,
        });
      }
    }
  }

  for (const [, eq] of equipmentMap) {
    await tx.companyEquipment.upsert({
      where: { companyId_equipmentId: { companyId, equipmentId: eq.equipmentId } },
      create: {
        companyId,
        equipmentId: eq.equipmentId,
        quantity: eq.requiredQuantity,
        isActive: true,
      },
      update: { quantity: eq.requiredQuantity, isActive: true },
    });

    if (eq.purchaseCost.isZero()) continue;
    const totalCost = eq.purchaseCost.mul(new Decimal(eq.requiredQuantity));
    const idempotencyKey = generateIdempotencyKey(
      'WAREHOUSE_NEW:CAPEX',
      companyId,
      buildingId,
      eq.code
    );
    const result = await postLedgerEntry(tx, {
      companyId,
      dayKey,
      direction: FinanceDirection.OUT,
      amountUsd: totalCost,
      category: FinanceCategory.CAPEX,
      scopeType: FinanceScopeType.COMPANY,
      counterpartyType: FinanceCounterpartyType.SYSTEM,
      refType: 'WAREHOUSE_EQUIPMENT',
      refId: eq.equipmentId,
      idempotencyKey,
      note: `New warehouse equipment: ${eq.code} x${eq.requiredQuantity}`,
    });
    results.push(result);
  }
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { countryId, cityId, marketZone } = body as {
      countryId?: string;
      cityId?: string;
      marketZone?: MarketZone;
    };

    if (!countryId || !cityId || !marketZone) {
      return NextResponse.json(
        { error: 'countryId, cityId, and marketZone are required' },
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
      select: { id: true, iso2: true, salaryMultiplier: true },
    });
    if (!country) {
      return NextResponse.json({ error: 'Country not found' }, { status: 400 });
    }

    const city = await prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, countryId: true },
    });
    if (!city || city.countryId !== countryId) {
      return NextResponse.json({ error: 'City not found or does not belong to country' }, { status: 400 });
    }

    const salaryMultiplier = country.salaryMultiplier?.toNumber() ?? 1.0;
    const countryCode = country.iso2;

    const dayKey = await getCompanyGameDayKey(company.id);

    const newBuilding = await prisma.$transaction(
      async (tx) => {
        const building = await createWarehouseBuilding(tx, {
          companyId: company.id,
          countryId,
          marketZone,
        });

        await initBuildingMetrics(tx, building);

        const allLedgerEntries: PostLedgerEntryResult[] = [];

        const setupEntries = await postWarehouseSetupCosts(tx, {
          companyId: company.id,
          buildingId: building.id,
          dayKey,
        });
        allLedgerEntries.push(...setupEntries);

        await assignStaffForBuilding(tx, {
          userId,
          companyId: company.id,
          building,
          countryCode,
          salaryMultiplier,
          dayKey,
        });

        const equipmentEntries = await assignEquipmentForBuilding(tx, {
          companyId: company.id,
          buildingId: building.id,
          dayKey,
        });
        allLedgerEntries.push(...equipmentEntries);

        await updateWalletUsdFromLedgerBatch(tx, userId, allLedgerEntries);

        return building;
      },
      { timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      building: {
        id: newBuilding.id,
        marketZone: newBuilding.marketZone,
        name: newBuilding.name,
      },
    });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json(
      {
        error: 'Failed to create warehouse',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
