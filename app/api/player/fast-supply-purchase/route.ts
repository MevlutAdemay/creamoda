/**
 * FAST SUPPLY purchase: atomic order + ledger + wallet + inventory + PlayerProduct snapshot.
 * POST body: { studioId, warehouseBuildingId, lines: [{ productTemplateId, qty }], idempotencyKey? }
 * Uses CompanyGameClock.currentDayKey for dayKey. Idempotent via idempotencyKey on order/ledger.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import {
  postLedgerEntryAndUpdateWallet,
  postWalletTransactionAndUpdateBalance,
  generateIdempotencyKey,
} from '@/lib/finance/helpers';
import {
  FinanceDirection,
  FinanceCategory,
  FinanceScopeType,
  FinanceCounterpartyType,
  UnlockMethod,
  ProductImageUnlockType,
  InventoryMovementType,
  InventorySourceType,
  WholesaleOrderStatus,
  BuildingRole,
  WalletCurrency,
  WalletDirection,
  WalletTxnCategory,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const MIN_QTY = 20;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      studioId,
      warehouseBuildingId,
      lines,
      idempotencyKey: clientKey,
    } = body as {
      studioId?: string;
      warehouseBuildingId?: string;
      lines?: Array<{ productTemplateId: string; qty: number }>;
      idempotencyKey?: string;
    };

    if (!studioId || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'studioId and non-empty lines are required' },
        { status: 400 }
      );
    }
    if (!warehouseBuildingId || typeof warehouseBuildingId !== 'string' || !warehouseBuildingId.trim()) {
      return NextResponse.json(
        { error: 'warehouseBuildingId is required' },
        { status: 400 }
      );
    }

    for (const line of lines) {
      if (!line.productTemplateId || typeof line.qty !== 'number' || line.qty < MIN_QTY) {
        return NextResponse.json(
          { error: `Each line must have productTemplateId and qty >= ${MIN_QTY}` },
          { status: 400 }
        );
      }
    }

    const userId = session.user.id;

    const company = await prisma.company.findFirst({
      where: { playerId: userId },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const companyId = company.id;

    const [warehouse, studio] = await Promise.all([
      prisma.companyBuilding.findFirst({
        where: { id: warehouseBuildingId, companyId },
        select: { id: true, role: true },
      }),
      prisma.designStudio.findUnique({
        where: { id: studioId },
        select: { id: true, fastSupplyMultiplier: true },
      }),
    ]);

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found or does not belong to your company' }, { status: 404 });
    }
    if (warehouse.role !== BuildingRole.WAREHOUSE) {
      return NextResponse.json({ error: 'Building is not a warehouse' }, { status: 403 });
    }
    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    const multiplier = Number(studio.fastSupplyMultiplier ?? 1);
    const productTemplateIds = [...new Set(lines.map((l) => l.productTemplateId))];

    const templates = await prisma.productTemplate.findMany({
      where: { id: { in: productTemplateIds } },
      select: {
        id: true,
        code: true,
        name: true,
        baseCost: true,
        suggestedSalePrice: true,
        unlockCostXp: true,
        unlockCostDiamond: true,
        productImageTemplates: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, unlockType: true, url: true },
        },
      },
    });

    const templateMap = new Map(templates.map((t) => [t.id, t]));
    for (const id of productTemplateIds) {
      if (!templateMap.has(id)) {
        return NextResponse.json({ error: `ProductTemplate not found: ${id}` }, { status: 404 });
      }
    }

    const dayKey = await getCompanyGameDayKey(companyId);

    let totalAmount = new Decimal(0);
    const linePayloads: Array<{
      productTemplateId: string;
      qty: number;
      productCode: string;
      productName: string;
      unitCost: Decimal;
      lineTotal: Decimal;
    }> = [];

    for (const line of lines) {
      const t = templateMap.get(line.productTemplateId)!;
      const baseCost = t.baseCost ? new Decimal(t.baseCost.toString()) : new Decimal(0);
      const unitCost = baseCost.mul(multiplier);
      const lineTotal = unitCost.mul(line.qty);
      totalAmount = totalAmount.add(lineTotal);
      linePayloads.push({
        productTemplateId: t.id,
        qty: line.qty,
        productCode: t.code,
        productName: t.name,
        unitCost,
        lineTotal,
      });
    }

    const wallet = await prisma.playerWallet.findUnique({
      where: { userId },
      select: { balanceUsd: true },
    });
    const balanceUsd = wallet?.balanceUsd ?? new Decimal(0);
    if (balanceUsd.lessThan(totalAmount)) {
      return NextResponse.json(
        { error: 'Insufficient USD balance' },
        { status: 400 }
      );
    }

    const idempotencyKey =
      clientKey && String(clientKey).trim() !== ''
        ? String(clientKey).trim()
        : generateIdempotencyKey('FAST_SUPPLY', companyId, studioId, warehouseBuildingId, JSON.stringify(lines));

    const result = await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        for (const lp of linePayloads) {
          const template = templateMap.get(lp.productTemplateId)!;
          const unlockCostXp = template.unlockCostXp ?? 0;
          const unlockCostDiamond = template.unlockCostDiamond ?? 0;
          const unlockMethod: UnlockMethod =
            unlockCostXp > 0 ? UnlockMethod.XP : unlockCostDiamond > 0 ? UnlockMethod.DIAMOND : UnlockMethod.FREE;

          const playerProduct = await tx.playerProduct.upsert({
            where: {
              companyId_productTemplateId: { companyId, productTemplateId: lp.productTemplateId },
            },
            create: {
              companyId,
              productTemplateId: lp.productTemplateId,
              displayName: template.name,
              baseCostOverride: template.baseCost,
              suggestedPriceOverride: template.suggestedSalePrice,
              launchedAtDayKey: dayKey,
              isUnlocked: true,
              unlockedAt: now,
              unlockMethod,
              unlockCostXp: unlockCostXp || null,
              unlockCostDiamond: unlockCostDiamond || null,
            },
            update: {
              isUnlocked: true,
              unlockedAt: now,
              unlockMethod,
              unlockCostXp: unlockCostXp || null,
              unlockCostDiamond: unlockCostDiamond || null,
            },
            select: { id: true },
          });

          for (const img of template.productImageTemplates) {
            const isAlwaysUnlock = img.unlockType === ProductImageUnlockType.ALWAYS;
            await tx.playerProductImage.upsert({
              where: {
                playerProductId_productImageTemplateId: {
                  playerProductId: playerProduct.id,
                  productImageTemplateId: img.id,
                },
              },
              create: {
                playerProductId: playerProduct.id,
                productImageTemplateId: img.id,
                isUnlocked: isAlwaysUnlock,
                unlockedAt: isAlwaysUnlock ? now : null,
                unlockMethod: isAlwaysUnlock ? UnlockMethod.FREE : null,
                paidXp: null,
                paidDiamond: null,
              },
              update: {
                isUnlocked: isAlwaysUnlock,
                unlockedAt: isAlwaysUnlock ? now : null,
                unlockMethod: isAlwaysUnlock ? UnlockMethod.FREE : null,
                paidXp: null,
                paidDiamond: null,
              },
            });
          }
        }

        const totalCost = totalAmount;
        const vat = new Decimal(0);
        const totalAmountFinal = totalCost.add(vat);

        const order = await tx.wholesaleOrder.create({
          data: {
            companyId,
            warehouseBuildingId,
            studioId,
            status: WholesaleOrderStatus.PAID,
            totalCost,
            vat,
            totalAmount: totalAmountFinal,
            awardXp: 100,
            paidAt: now,
            lines: {
              create: linePayloads.map((lp) => ({
                productTemplateId: lp.productTemplateId,
                productCode: lp.productCode,
                productName: lp.productName,
                qty: lp.qty,
                unitCost: lp.unitCost,
                lineTotal: lp.lineTotal,
              })),
            },
          },
          select: { id: true, awardXp: true },
        });

        for (const lp of linePayloads) {
          const playerProduct = await tx.playerProduct.findUnique({
            where: {
              companyId_productTemplateId: { companyId, productTemplateId: lp.productTemplateId },
            },
            select: { id: true },
          });
          if (!playerProduct) throw new Error('PlayerProduct not created');

          const existingItem = await tx.buildingInventoryItem.findUnique({
            where: {
              companyBuildingId_productTemplateId: {
                companyBuildingId: warehouseBuildingId,
                productTemplateId: lp.productTemplateId,
              },
            },
            select: { id: true, qtyOnHand: true, avgUnitCost: true },
          });

          const qtyChange = lp.qty;
          const unitCostDec = lp.unitCost;

          if (existingItem) {
            const oldQty = existingItem.qtyOnHand;
            const oldAvg = new Decimal(existingItem.avgUnitCost.toString());
            const newQty = oldQty + qtyChange;
            const newAvg = oldQty + qtyChange === 0
              ? oldAvg
              : oldAvg.mul(oldQty).add(unitCostDec.mul(qtyChange)).div(newQty);

            await tx.buildingInventoryItem.update({
              where: { id: existingItem.id },
              data: {
                qtyOnHand: newQty,
                avgUnitCost: newAvg,
                lastUnitCost: unitCostDec,
                playerProductId: playerProduct.id,
                updatedAt: now,
              },
            });
          } else {
            await tx.buildingInventoryItem.create({
              data: {
                companyBuildingId: warehouseBuildingId,
                productTemplateId: lp.productTemplateId,
                playerProductId: playerProduct.id,
                qtyOnHand: qtyChange,
                qtyReserved: 0,
                avgUnitCost: unitCostDec,
                lastUnitCost: unitCostDec,
              },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              companyBuildingId: warehouseBuildingId,
              productTemplateId: lp.productTemplateId,
              playerProductId: playerProduct.id,
              movementType: InventoryMovementType.IN,
              sourceType: InventorySourceType.FAST_SUPPLY,
              sourceRefId: order.id,
              qtyChange,
              unitCost: unitCostDec,
              dayKey,
            },
          });
        }

        const ledgerKey = `${idempotencyKey}:ledger`;
        await postLedgerEntryAndUpdateWallet(tx, userId, {
          companyId,
          dayKey,
          direction: FinanceDirection.OUT,
          amountUsd: totalAmountFinal,
          category: FinanceCategory.WHOLESALE,
          scopeType: FinanceScopeType.BUILDING,
          scopeId: warehouseBuildingId,
          counterpartyType: FinanceCounterpartyType.SUPPLIER,
          counterpartyId: studioId,
          refType: 'WHOLESALE_ORDER',
          refId: order.id,
          idempotencyKey: ledgerKey,
          note: 'WHOLESALE',
        });

        const awardXp = order.awardXp ?? 0;
        if (awardXp > 0) {
          const xpIdempotencyKey = `${idempotencyKey}:XP_AWARD`;
          await postWalletTransactionAndUpdateBalance(tx, {
            userId,
            companyId,
            dayKey,
            currency: WalletCurrency.XP,
            direction: WalletDirection.IN,
            amount: awardXp,
            category: WalletTxnCategory.REWARD,
            refType: 'WholesaleOrder',
            refId: order.id,
            idempotencyKey: xpIdempotencyKey,
            note: 'FAST_SUPPLY award XP',
          });
        }

        const updatedWallet = await tx.playerWallet.findUnique({
          where: { userId },
          select: { balanceUsd: true, balanceXp: true },
        });

        return {
          orderId: order.id,
          balanceUsd: updatedWallet?.balanceUsd ?? new Decimal(0),
          balanceXp: updatedWallet?.balanceXp ?? 0,
          affectedProductTemplateIds: linePayloads.map((lp) => lp.productTemplateId),
        };
      },
      { timeout: 20000 }
    );

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      balanceUsd: Number(result.balanceUsd),
      balanceXp: result.balanceXp,
      affectedProductTemplateIds: result.affectedProductTemplateIds,
    });
  } catch (err) {
    console.error('Fast supply purchase error:', err);
    const message = err instanceof Error ? err.message : 'Purchase failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
