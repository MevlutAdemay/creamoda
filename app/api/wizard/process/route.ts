// app/api/wizard/process/route.ts
/**
 * Wizard Step 3: Process Setup
 * 
 * Executes setup in a transaction with idempotent patterns:
 * 1. Ensure GameClock exists (2025-09-10)
 * 2. Ensure buildings exist (HQ + WAREHOUSE)
 * 3. Initialize BuildingMetricState for each building (NEW)
 * 4. Post EconomyConfig setup costs to ledger (NEW)
 * 5. Assign Level 1 Staff for BOTH HQ and WAREHOUSE
 * 6. Assign Level 1 Equipment and post CAPEX ledger entries
 * 7. Update PlayerWallet balances (USD decreased, XP increased) (NEW)
 * 8. Award XP transaction
 * 9. Update User: status=DONE, step=null, completedAt=now()
 * 
 * All operations use idempotent patterns (check-then-create, upsert).
 * Double-submit will not duplicate records or re-apply balance changes.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import {
  BuildingRole,
  OnboardingStatus,
  FinanceCategory,
  FinanceDirection,
  FinanceScopeType,
  FinanceCounterpartyType,
  WalletCurrency,
  WalletDirection,
  WalletTxnCategory,
  StaffGender,
  CompanyBuilding,
  MetricType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  generateIdempotencyKey,
  postLedgerEntry,
  postWalletTransactionAndUpdateBalance,
  PostLedgerEntryResult,
  updateWalletUsdFromLedgerBatch,
} from '@/lib/finance/helpers';
import { DEFAULT_GAME_START_DATE, normalizeUtcMidnight } from '@/lib/game/game-clock';
import { getSeededStaffName } from '@/lib/staff/seeded-staff-name';
import { ensureCompanyBuildings } from '@/lib/company/ensure-company-buildings';
import { initBuildingMetrics, getBuildingSetupCosts } from '@/lib/buildings/init-building-metrics';
import { createHash } from 'crypto';

// Constants
const WIZARD_XP_AWARD = 500; // XP awarded for completing wizard

export async function POST() {
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

    // 2. Pre-check: Get current user state
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingStatus: true,
        onboardingStep: true,
        companies: {
          take: 1,
          select: {
            id: true,
            countryId: true,
            country: {
              select: {
                iso2: true,
                salaryMultiplier: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Already done? Return success (idempotent)
    if (user.onboardingStatus === OnboardingStatus.DONE) {
      return NextResponse.json({
        success: true,
        alreadyDone: true,
        message: 'Onboarding already completed',
      });
    }

    // No company? Error
    if (!user.companies?.[0]) {
      return NextResponse.json(
        { error: 'No company found. Please complete Step 1 first.' },
        { status: 400 }
      );
    }

    const company = user.companies[0];
    const companyId = company.id;
    const countryId = company.countryId;
    const countryCode = company.country.iso2;
    const salaryMultiplier = company.country.salaryMultiplier?.toNumber() || 1.0;

    // 3. Set step to PROCESSING (outside transaction for visibility)
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingStep: 'PROCESSING' },
    });

    // 4. Execute transaction
    const dayKey = normalizeUtcMidnight(DEFAULT_GAME_START_DATE);

    await prisma.$transaction(async (tx) => {
      // Collect all ledger entries to update wallet balance at the end
      const allLedgerEntries: PostLedgerEntryResult[] = [];

      // a. Create/Get GameClock
      await tx.companyGameClock.upsert({
        where: { companyId },
        create: {
          companyId,
          currentDayKey: dayKey,
          startedAtDayKey: dayKey,
          isPaused: false,
        },
        update: {}, // No-op if exists
      });

      // b. Ensure buildings exist (HQ + WAREHOUSE) - idempotent
      const { hqBuilding, warehouseBuilding } = await ensureCompanyBuildings(tx, {
        companyId,
        countryId,
      });

      // c. Initialize BuildingMetricState for each building (NEW)
      await initBuildingMetrics(tx, hqBuilding);
      await initBuildingMetrics(tx, warehouseBuilding);

      // d. Post EconomyConfig setup costs to ledger (NEW)
      const hqSetupEntries = await postBuildingSetupCosts(tx, {
        companyId,
        buildingId: hqBuilding.id,
        buildingRole: BuildingRole.HQ,
        dayKey,
      });
      allLedgerEntries.push(...hqSetupEntries);

      const warehouseSetupEntries = await postBuildingSetupCosts(tx, {
        companyId,
        buildingId: warehouseBuilding.id,
        buildingRole: BuildingRole.WAREHOUSE,
        dayKey,
      });
      allLedgerEntries.push(...warehouseSetupEntries);

      // e. Assign Level 1 Staff for HQ
      const hqStaffCounts = await assignStaffForBuilding(tx, {
        userId,
        companyId,
        building: hqBuilding,
        countryCode,
        salaryMultiplier,
        dayKey, // Game simulation dayKey for hiredAt
      });

      // f. Assign Level 1 Staff for WAREHOUSE
      const warehouseStaffCounts = await assignStaffForBuilding(tx, {
        userId,
        companyId,
        building: warehouseBuilding,
        countryCode,
        salaryMultiplier,
        dayKey, // Game simulation dayKey for hiredAt
      });

      // Dev log: Gender distribution
      const totalMale = hqStaffCounts.maleCount + warehouseStaffCounts.maleCount;
      const totalFemale = hqStaffCounts.femaleCount + warehouseStaffCounts.femaleCount;
      console.log(
        `[Wizard Process] Staff created - HQ: ${hqStaffCounts.maleCount}M/${hqStaffCounts.femaleCount}F, ` +
        `WAREHOUSE: ${warehouseStaffCounts.maleCount}M/${warehouseStaffCounts.femaleCount}F, ` +
        `Total: ${totalMale}M/${totalFemale}F`
      );

      // g. Assign Level 1 Equipment and post ledger entries for HQ
      const hqEquipmentEntries = await assignEquipmentForBuilding(tx, {
        companyId,
        buildingRole: BuildingRole.HQ,
        dayKey,
      });
      allLedgerEntries.push(...hqEquipmentEntries);

      // h. Assign Level 1 Equipment and post ledger entries for WAREHOUSE
      const warehouseEquipmentEntries = await assignEquipmentForBuilding(tx, {
        companyId,
        buildingRole: BuildingRole.WAREHOUSE,
        dayKey,
      });
      allLedgerEntries.push(...warehouseEquipmentEntries);

      // i. Update PlayerWallet USD balance from all ledger entries (NEW)
      await updateWalletUsdFromLedgerBatch(tx, userId, allLedgerEntries);

      // j. Award XP transaction and update XP balance
      const xpIdempotencyKey = generateIdempotencyKey('WIZARD:XP', companyId, userId);
      await postWalletTransactionAndUpdateBalance(tx, {
        userId,
        companyId,
        dayKey,
        currency: WalletCurrency.XP,
        direction: WalletDirection.IN,
        amount: WIZARD_XP_AWARD,
        category: WalletTxnCategory.REWARD,
        refType: 'WIZARD_COMPLETION',
        refId: companyId,
        idempotencyKey: xpIdempotencyKey,
        note: 'Wizard completion reward',
      });

      // k. Update User
      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingStatus: OnboardingStatus.DONE,
          onboardingStep: null,
          onboardingCompletedAt: new Date(),
        },
      });
    }, {
      timeout: 90000, // 90 second timeout for the transaction (more work now)
    });

    return NextResponse.json({
      success: true,
      message: 'Company setup completed successfully',
    });
  } catch (error) {
    console.error('Error processing wizard:', error);
    
    // Try to reset step on error
    try {
      const session = await getServerSession();
      if (session) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { onboardingStep: 'REVIEW' },
        });
      }
    } catch (resetError) {
      console.error('Error resetting step:', resetError);
    }

    return NextResponse.json(
      {
        error: 'Failed to process wizard',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Type for transaction client
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Post EconomyConfig setup/upgrade costs to ledger for a building.
 * Uses idempotent postLedgerEntry that tracks isNew for balance updates.
 */
async function postBuildingSetupCosts(
  tx: TxClient,
  params: {
    companyId: string;
    buildingId: string;
    buildingRole: BuildingRole;
    dayKey: Date;
  }
): Promise<PostLedgerEntryResult[]> {
  const { companyId, buildingId, buildingRole, dayKey } = params;
  const results: PostLedgerEntryResult[] = [];

  // Get setup costs from EconomyConfig for this building role at level 1
  const setupCosts = await getBuildingSetupCosts(tx, buildingRole);

  for (const cost of setupCosts) {
    // Skip if no cost
    if (cost.upgradeCostMoney.isZero()) {
      continue;
    }

    // Deterministic idempotency key per building and metricType
    const idempotencyKey = generateIdempotencyKey(
      'WIZARD:SETUP',
      companyId,
      buildingRole,
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
      refType: 'WIZARD_SETUP',
      refId: buildingId,
      idempotencyKey,
      note: `Wizard setup (${buildingRole}/${cost.metricType}): Level 1 initialization`,
    });

    results.push(result);
  }

  return results;
}

/**
 * Assign Level 1 staff for a specific building based on StaffingRule.
 * Updates BuildingMetricState.EMPLOYEE_COUNT after staff creation.
 * 
 * @returns Object with counts of MALE and FEMALE staff created
 */
async function assignStaffForBuilding(
  tx: TxClient,
  params: {
    userId: string;
    companyId: string;
    building: CompanyBuilding;
    countryCode: string;
    salaryMultiplier: number;
    dayKey: Date; // Game simulation dayKey (UTC midnight) for hiredAt
  }
): Promise<{ maleCount: number; femaleCount: number }> {
  const { userId, companyId, building, countryCode, salaryMultiplier } = params;
  const buildingId = building.id;
  const buildingRole = building.role;

  // Get required staff from StaffingRule for this building role
  const rules = await tx.staffingRule.findMany({
    where: { buildingRole, level: 1 },
    orderBy: [
      { departmentCode: 'asc' },
      { roleCode: 'asc' },
    ],
  });

  let maleCount = 0;
  let femaleCount = 0;

  for (const rule of rules) {
    // Check existing count for this specific building
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

    // Create missing staff
    for (let i = 0; i < needed; i++) {
      const index = existingCount + i;
      
      // Deterministic gender selection using hash (50/50 but deterministic)
      // Seed: userId:companyId:buildingRole:roleCode:index
      const genderSeed = `${userId}:${companyId}:${buildingRole}:${rule.roleCode}:${index}`;
      const hash = createHash('sha256').update(genderSeed).digest();
      const genderValue = hash.readUInt32BE(0) % 2;
      const requestedGender: StaffGender = genderValue === 0 ? StaffGender.MALE : StaffGender.FEMALE;

      // Get deterministic name - include buildingRole in seed for uniqueness
      // getSeededStaffName handles gender fallback internally
      let name: { firstName: string; lastName: string; gender: StaffGender };
      try {
        name = await getSeededStaffName(tx, {
          countryCode,
          gender: requestedGender,
          userId,
          companyId,
          roleCode: `${buildingRole}:${rule.roleCode}`, // Include building role in seed
          index,
        });
      } catch (nameError) {
        // Fallback to generic name if no templates available
        console.warn(`Staff name fallback for ${countryCode}/${requestedGender}:`, nameError);
        name = {
          firstName: requestedGender === StaffGender.FEMALE ? 'Jane' : 'John',
          lastName: 'Doe',
          gender: requestedGender,
        };
      }

      // Use the actual gender from name selection (may differ from requested due to fallback)
      const actualGender = name.gender;
      
      // Track gender counts
      if (actualGender === StaffGender.MALE) {
        maleCount++;
      } else {
        femaleCount++;
      }

      const baseSalary = rule.baseMonthlySalary;
      const finalSalary = baseSalary.mul(new Decimal(salaryMultiplier));

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
          gender: actualGender, // Use actual gender from name selection
          baseMonthlySalary: baseSalary,
          baseCurrencyCode: 'USD',
          salaryMultiplierApplied: new Decimal(salaryMultiplier),
          monthlySalaryFinal: finalSalary,
          hiredAt: params.dayKey, // Use game simulation dayKey, not system time
        },
      });
    }
  }

  // Update BuildingMetricState.EMPLOYEE_COUNT for this building
  // Always recompute from CompanyStaff for idempotency
  const activeCount = await tx.companyStaff.count({
    where: {
      buildingId,
      firedAt: null, // Only count active staff
    },
  });

  await tx.buildingMetricState.upsert({
    where: {
      buildingId_metricType: {
        buildingId,
        metricType: MetricType.EMPLOYEE_COUNT,
      },
    },
    create: {
      buildingId,
      metricType: MetricType.EMPLOYEE_COUNT,
      currentLevel: 1,
      currentCount: activeCount,
      lastEvaluatedAt: new Date(),
    },
    update: {
      currentCount: activeCount,
      lastEvaluatedAt: new Date(),
    },
  });

  return { maleCount, femaleCount };
}

/**
 * Assign Level 1 equipment for a specific building role and post ledger entries.
 * Returns ledger entry results for wallet balance update.
 */
async function assignEquipmentForBuilding(
  tx: TxClient,
  params: {
    companyId: string;
    buildingRole: BuildingRole;
    dayKey: Date;
  }
): Promise<PostLedgerEntryResult[]> {
  const { companyId, buildingRole, dayKey } = params;
  const results: PostLedgerEntryResult[] = [];

  // Get required equipment from RequirementEquipment for this building role at Level 1
  const requirementRules = await tx.requirementRule.findMany({
    where: {
      buildingRole,
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

  // Aggregate equipment requirements (take max quantity for each)
  const equipmentMap = new Map<string, {
    equipmentId: string;
    code: string;
    requiredQuantity: number;
    purchaseCost: Decimal;
  }>();

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

  // Upsert each equipment and post ledger entry
  for (const [, eq] of equipmentMap) {
    // Upsert equipment (company-level, not building-specific)
    await tx.companyEquipment.upsert({
      where: {
        companyId_equipmentId: { companyId, equipmentId: eq.equipmentId },
      },
      create: {
        companyId,
        equipmentId: eq.equipmentId,
        quantity: eq.requiredQuantity,
        isActive: true,
      },
      update: {
        // Set to required quantity (not increment, for idempotency)
        quantity: eq.requiredQuantity,
        isActive: true,
      },
    });

    // Skip ledger entry if no cost
    if (eq.purchaseCost.isZero()) {
      continue;
    }

    // Calculate total cost
    const totalCost = eq.purchaseCost.mul(new Decimal(eq.requiredQuantity));

    // Post CAPEX ledger entry - include buildingRole in idempotency key
    const idempotencyKey = generateIdempotencyKey('WIZARD:CAPEX', companyId, buildingRole, eq.code);
    const result = await postLedgerEntry(tx, {
      companyId,
      dayKey,
      direction: FinanceDirection.OUT,
      amountUsd: totalCost,
      category: FinanceCategory.CAPEX,
      scopeType: FinanceScopeType.COMPANY,
      counterpartyType: FinanceCounterpartyType.SYSTEM,
      refType: 'WIZARD_EQUIPMENT',
      refId: eq.equipmentId,
      idempotencyKey,
      note: `Wizard setup (${buildingRole}): ${eq.code} x${eq.requiredQuantity}`,
    });

    results.push(result);
  }

  return results;
}
