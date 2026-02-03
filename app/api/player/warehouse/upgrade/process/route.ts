/**
 * POST /api/player/warehouse/upgrade/process
 * Body: { buildingId: string, metricType: "STOCK_COUNT"|"SALES_COUNT", expectedTargetLevel?: number }
 * Performs warehouse metric upgrade from currentLevel -> currentLevel+1.
 * Idempotent per buildingId+metricType+targetLevel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import {
  BuildingRole,
  DepartmentCode,
  FinanceCategory,
  FinanceDirection,
  FinanceScopeType,
  FinanceCounterpartyType,
  MetricType,
  StaffGender,
  StaffRoleStyle,
  WalletCurrency,
  WalletDirection,
  WalletTxnCategory,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { createHash } from 'crypto';
import {
  postLedgerEntry,
  PostLedgerEntryResult,
  updateWalletUsdFromLedgerBatch,
  postWalletTransactionAndUpdateBalance,
} from '@/lib/finance/helpers';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { getSeededStaffName } from '@/lib/staff/seeded-staff-name';

const VALID_METRIC_TYPES: MetricType[] = [MetricType.STOCK_COUNT, MetricType.SALES_COUNT];

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function upgradeIdempotencyKey(
  buildingId: string,
  metricType: string,
  targetLevel: number,
  suffix: string
): string {
  return `WAREHOUSE_UPGRADE:${buildingId}:${metricType}:L${targetLevel}:${suffix}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      buildingId,
      metricType: metricTypeParam,
      expectedTargetLevel,
    } = body as {
      buildingId?: string;
      metricType?: string;
      expectedTargetLevel?: number;
    };

    if (!buildingId || typeof buildingId !== 'string' || !buildingId.trim()) {
      return NextResponse.json({ error: 'buildingId is required' }, { status: 400 });
    }
    if (!metricTypeParam || !VALID_METRIC_TYPES.includes(metricTypeParam as MetricType)) {
      return NextResponse.json(
        { error: 'metricType must be STOCK_COUNT or SALES_COUNT' },
        { status: 400 }
      );
    }
    const metricType = metricTypeParam as MetricType;
    const userId = session.user.id;

    const company = await prisma.company.findFirst({
      where: { playerId: userId },
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
        countryId: true,
        country: { select: { iso2: true, salaryMultiplier: true } },
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

    if (expectedTargetLevel != null && expectedTargetLevel !== targetLevel) {
      return NextResponse.json(
        {
          error: 'Expected target level does not match current state',
          expectedTargetLevel,
          actualTargetLevel: targetLevel,
        },
        { status: 409 }
      );
    }

    const [targetLevelConfig, economyConfig, staffingRules, requirementRule] = await Promise.all([
      prisma.metricLevelConfig.findUnique({
        where: {
          buildingRole_metricType_level: {
            buildingRole: BuildingRole.WAREHOUSE,
            metricType,
            level: targetLevel,
          },
        },
        select: { minRequired: true },
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
                  purchaseCostMoney: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!targetLevelConfig) {
      return NextResponse.json(
        { error: `No upgrade configuration for level ${targetLevel}` },
        { status: 400 }
      );
    }
    if (currentCount < targetLevelConfig.minRequired) {
      return NextResponse.json(
        {
          error: 'Not eligible',
          detail: `Current count (${currentCount}) is below required (${targetLevelConfig.minRequired}) for level ${targetLevel}.`,
        },
        { status: 400 }
      );
    }

    const upgradeCostMoney = economyConfig ? Number(economyConfig.upgradeCostMoney) : 0;
    const salaryMultiplier = building.country?.salaryMultiplier
      ? Number(building.country.salaryMultiplier)
      : 1.0;
    const countryCode = building.country?.iso2 ?? 'US';

    const equipmentRequirements = requirementRule?.equipmentRequirements ?? [];
    const equipmentIds = equipmentRequirements.map((r) => r.equipment.id);
    const companyEquipmentList =
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
      companyEquipmentList.map((e) => [e.equipmentId, e.quantity])
    );

    const equipmentDeltas: Array<{
      equipmentId: string;
      code: string;
      neededQty: number;
      unitCost: Decimal;
      totalCost: number;
    }> = [];
    for (const req of equipmentRequirements) {
      const requiredQty = req.requiredQuantity;
      const ownedQty = ownedByEquipmentId.get(req.equipment.id) ?? 0;
      const neededQty = Math.max(requiredQty - ownedQty, 0);
      if (neededQty <= 0) continue;
      const unitCost = req.equipment.purchaseCostMoney;
      const totalCost = Number(unitCost) * neededQty;
      equipmentDeltas.push({
        equipmentId: req.equipment.id,
        code: req.equipment.code,
        neededQty,
        unitCost,
        totalCost,
      });
    }

    const equipmentCostMoney = equipmentDeltas.reduce((sum, e) => sum + e.totalCost, 0);
    const totalCostMoney = upgradeCostMoney + equipmentCostMoney;

    const wallet = await prisma.playerWallet.findUnique({
      where: { userId },
      select: { balanceUsd: true },
    });
    const balanceUsd = wallet?.balanceUsd ?? new Decimal(0);
    if (balanceUsd.lessThan(totalCostMoney)) {
      return NextResponse.json(
        {
          error: 'Insufficient funds',
          detail: `Required ${totalCostMoney} USD, balance ${balanceUsd.toFixed(2)} USD.`,
        },
        { status: 400 }
      );
    }

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

    const staffToHire: Array<{
      departmentCode: DepartmentCode;
      roleCode: string;
      roleName: string;
      roleStyle: StaffRoleStyle;
      neededHeadcount: number;
      baseMonthlySalary: Decimal;
    }> = [];
    for (const rule of staffingRules) {
      const existing = staffCountByRole.get(rule.roleCode) ?? 0;
      const needed = Math.max(rule.deltaHeadcount - existing, 0);
      if (needed <= 0) continue;
      staffToHire.push({
        departmentCode: rule.departmentCode,
        roleCode: rule.roleCode,
        roleName: rule.roleName,
        roleStyle: rule.roleStyle,
        neededHeadcount: needed,
        baseMonthlySalary: rule.baseMonthlySalary,
      });
    }

    const dayKey = await getCompanyGameDayKey(company.id);
    const baseKey = `WAREHOUSE_UPGRADE:${buildingId}:${metricType}:L${targetLevel}`;

    const result = await prisma.$transaction(
      async (tx) => {
        const previousLevel = currentLevel;

        const claimResult = await tx.buildingMetricState.updateMany({
          where: {
            buildingId,
            metricType,
            currentLevel: targetLevel - 1,
          },
          data: {
            currentLevel: targetLevel,
            lastEvaluatedAt: new Date(),
            lastUpgradedAt: new Date(),
            ...(economyConfig && {
              areaM2: economyConfig.areaM2 ?? undefined,
              rentPerMonthly: economyConfig.rentPerMonthly ?? undefined,
              overheadMonthly: economyConfig.overheadMonthly ?? undefined,
            }),
          },
        });

        if (claimResult.count === 0) {
          return {
            idempotent: true,
            buildingId,
            metricType,
            previousLevel: targetLevel,
            newLevel: targetLevel,
            chargedUsd: 0,
            equipmentPurchasedUsd: 0,
            staffHired: 0,
            awardXp: 0,
          };
        }

        const ledgerResults: PostLedgerEntryResult[] = [];

        if (upgradeCostMoney > 0) {
          const upgradeKey = upgradeIdempotencyKey(buildingId, metricType, targetLevel, 'UPGRADE_COST');
          const r = await postLedgerEntry(tx, {
            companyId: company.id,
            dayKey,
            direction: FinanceDirection.OUT,
            amountUsd: upgradeCostMoney,
            category: FinanceCategory.CAPEX,
            scopeType: FinanceScopeType.BUILDING,
            scopeId: buildingId,
            counterpartyType: FinanceCounterpartyType.SYSTEM,
            refType: 'WAREHOUSE_UPGRADE',
            refId: buildingId,
            idempotencyKey: upgradeKey,
            note: `Warehouse upgrade ${metricType} to level ${targetLevel}`,
          });
          ledgerResults.push(r);
        }

        if (equipmentCostMoney > 0) {
          const equipKey = upgradeIdempotencyKey(buildingId, metricType, targetLevel, 'EQUIPMENT_TOTAL');
          const r = await postLedgerEntry(tx, {
            companyId: company.id,
            dayKey,
            direction: FinanceDirection.OUT,
            amountUsd: equipmentCostMoney,
            category: FinanceCategory.CAPEX,
            scopeType: FinanceScopeType.BUILDING,
            scopeId: buildingId,
            counterpartyType: FinanceCounterpartyType.SYSTEM,
            refType: 'WAREHOUSE_EQUIPMENT_UPGRADE',
            refId: buildingId,
            idempotencyKey: equipKey,
            note: `Warehouse equipment upgrade ${metricType} L${targetLevel}`,
          });
          ledgerResults.push(r);
        }

        updateWalletUsdFromLedgerBatch(tx, userId, ledgerResults);

        for (const eq of equipmentDeltas) {
          await tx.companyEquipment.upsert({
            where: {
              companyId_equipmentId: { companyId: company.id, equipmentId: eq.equipmentId },
            },
            create: {
              companyId: company.id,
              equipmentId: eq.equipmentId,
              quantity: eq.neededQty,
              isActive: true,
            },
            update: { quantity: { increment: eq.neededQty } },
          });
        }

        let totalStaffHired = 0;
        for (const item of staffToHire) {
          const existingCount = staffCountByRole.get(item.roleCode) ?? 0;
          for (let i = 0; i < item.neededHeadcount; i++) {
            const index = existingCount + i;
            const genderSeed = `${userId}:${company.id}:${BuildingRole.WAREHOUSE}:${item.roleCode}:${targetLevel}:${index}`;
            const hash = createHash('sha256').update(genderSeed).digest();
            const genderValue = hash.readUInt32BE(0) % 2;
            const requestedGender: StaffGender = genderValue === 0 ? StaffGender.MALE : StaffGender.FEMALE;

            let name: { firstName: string; lastName: string; gender: StaffGender };
            try {
              name = await getSeededStaffName(tx, {
                countryCode,
                gender: requestedGender,
                userId,
                companyId: company.id,
                roleCode: `${BuildingRole.WAREHOUSE}:${item.roleCode}`,
                index,
              });
            } catch {
              name = {
                firstName: requestedGender === StaffGender.FEMALE ? 'Jane' : 'John',
                lastName: 'Doe',
                gender: requestedGender,
              };
            }

            const finalSalary = item.baseMonthlySalary.mul(new Decimal(salaryMultiplier));
            await tx.companyStaff.create({
              data: {
                companyId: company.id,
                buildingId,
                metricType,
                level: targetLevel,
                departmentCode: item.departmentCode,
                roleCode: item.roleCode,
                roleName: item.roleName,
                roleStyle: item.roleStyle,
                fullName: `${name.firstName} ${name.lastName}`,
                gender: name.gender,
                baseMonthlySalary: item.baseMonthlySalary,
                baseCurrencyCode: 'USD',
                salaryMultiplierApplied: new Decimal(salaryMultiplier),
                monthlySalaryFinal: finalSalary,
                hiredAt: dayKey,
              },
            });
            totalStaffHired++;
          }
          staffCountByRole.set(item.roleCode, (staffCountByRole.get(item.roleCode) ?? 0) + item.neededHeadcount);
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

        const awardXp = economyConfig?.awardXpOnUpgrade ?? 0;
        if (awardXp > 0) {
          const xpKey = upgradeIdempotencyKey(buildingId, metricType, targetLevel, 'XP');
          await postWalletTransactionAndUpdateBalance(tx, {
            userId,
            companyId: company.id,
            dayKey,
            currency: WalletCurrency.XP,
            direction: WalletDirection.IN,
            amount: awardXp,
            category: WalletTxnCategory.REWARD,
            refType: 'WAREHOUSE_UPGRADE',
            refId: buildingId,
            idempotencyKey: xpKey,
            note: `Warehouse upgrade ${metricType} L${targetLevel}`,
          });
        }

        return {
          idempotent: false,
          buildingId,
          metricType,
          previousLevel,
          newLevel: targetLevel,
          chargedUsd: totalCostMoney,
          equipmentPurchasedUsd: equipmentCostMoney,
          staffHired: totalStaffHired,
          awardXp: awardXp,
        };
      },
      { timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      buildingId: result.buildingId,
      metricType: result.metricType,
      previousLevel: result.previousLevel,
      newLevel: result.newLevel,
      chargedUsd: result.chargedUsd,
      equipmentPurchasedUsd: result.equipmentPurchasedUsd,
      staffHired: result.staffHired,
      awardXp: result.awardXp,
    });
  } catch (err) {
    console.error('POST /api/player/warehouse/upgrade/process error:', err);
    return NextResponse.json(
      {
        error: 'Failed to process warehouse upgrade',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
