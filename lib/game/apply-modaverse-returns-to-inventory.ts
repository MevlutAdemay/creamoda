/**
 * Restock returned units from a Modaverse settlement into warehouse inventory.
 * Called after settlement + lines are created. Idempotent per product (no double restock).
 * No ledger entry; money effect already applied via returnDeductionUsd on lines.
 */

import type { PrismaClient } from '@prisma/client';
import {
  InventoryMovementType,
  InventorySourceType,
  MetricType,
  MessageCategory,
  MessageLevel,
  MessageKind,
  DepartmentCode,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export type ApplyModaverseReturnsToInventoryParams = {
  companyId: string;
  warehouseBuildingId: string;
  settlementId: string;
  payoutDayKey: Date;
  playerId: string;
  warehouseName?: string | null;
};

/**
 * For each settlement line with returnQty > 0:
 * - Idempotency: skip if InventoryMovement already exists (sourceType=RETURNS_RESTOCK, sourceRefId=settlementId:productTemplateId).
 * - Upsert BuildingInventoryItem: increment qtyOnHand (do not change avgUnitCost); create if missing with avgUnitCost=0.
 * - Create InventoryMovement (IN, RETURNS_RESTOCK) for audit.
 * - Increment BuildingMetricState(STOCK_COUNT).currentCount by totalReturnedUnits.
 * - Optional: one PlayerMessage (LOGISTICS, dedupeKey RETURNS_RESTOCK:settlementId).
 */
export async function applyModaverseReturnsToInventory(
  tx: Tx,
  params: ApplyModaverseReturnsToInventoryParams
): Promise<{ totalReturnedUnits: number }> {
  const {
    companyId,
    warehouseBuildingId,
    settlementId,
    payoutDayKey,
    playerId,
    warehouseName,
  } = params;

  const [settlement, building] = await Promise.all([
    tx.modaverseSettlement.findUnique({
      where: { id: settlementId },
      select: { id: true, companyId: true, warehouseBuildingId: true, payoutDayKey: true },
    }),
    tx.companyBuilding.findUnique({
      where: { id: warehouseBuildingId },
      select: { name: true },
    }),
  ]);
  if (!settlement) return { totalReturnedUnits: 0 };
  const buildingName = warehouseName ?? building?.name ?? null;

  const lines = await tx.modaverseSettlementLine.findMany({
    where: { settlementId },
    select: { id: true, productTemplateId: true, returnQty: true },
  });
  const linesWithReturns = lines.filter((l) => l.returnQty > 0);
  if (linesWithReturns.length === 0) return { totalReturnedUnits: 0 };

  let totalReturnedUnits = 0;

  for (const line of linesWithReturns) {
    const qty = line.returnQty;
    const sourceRefId = `${settlementId}:${line.productTemplateId}`;

    const existingMovement = await tx.inventoryMovement.findFirst({
      where: {
        companyBuildingId: warehouseBuildingId,
        sourceType: InventorySourceType.RETURNS_RESTOCK,
        sourceRefId,
      },
    });
    if (existingMovement) continue;

    const existingItem = await tx.buildingInventoryItem.findUnique({
      where: {
        companyBuildingId_productTemplateId: {
          companyBuildingId: warehouseBuildingId,
          productTemplateId: line.productTemplateId,
        },
      },
      select: { id: true, qtyOnHand: true, avgUnitCost: true, playerProductId: true },
    });

    const unitCost = existingItem?.avgUnitCost ?? new Decimal(0);

    if (existingItem) {
      await tx.buildingInventoryItem.update({
        where: { id: existingItem.id },
        data: { qtyOnHand: { increment: qty } },
      });
    } else {
      await tx.buildingInventoryItem.create({
        data: {
          companyBuildingId: warehouseBuildingId,
          productTemplateId: line.productTemplateId,
          playerProductId: null,
          qtyOnHand: qty,
          qtyReserved: 0,
          avgUnitCost: 0,
          lastUnitCost: 0,
        },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        companyBuildingId: warehouseBuildingId,
        productTemplateId: line.productTemplateId,
        playerProductId: existingItem?.playerProductId ?? undefined,
        movementType: InventoryMovementType.IN,
        sourceType: InventorySourceType.RETURNS_RESTOCK,
        sourceRefId,
        qtyChange: qty,
        unitCost,
        dayKey: payoutDayKey,
      },
    });

    totalReturnedUnits += qty;
  }

  if (totalReturnedUnits > 0) {
    await tx.buildingMetricState.upsert({
      where: {
        buildingId_metricType: {
          buildingId: warehouseBuildingId,
          metricType: MetricType.STOCK_COUNT,
        },
      },
      create: {
        buildingId: warehouseBuildingId,
        metricType: MetricType.STOCK_COUNT,
        currentCount: totalReturnedUnits,
        currentLevel: 1,
        lastEvaluatedAt: new Date(),
      },
      update: {
        currentCount: { increment: totalReturnedUnits },
        lastEvaluatedAt: new Date(),
      },
    });

    const dedupeKey = `RETURNS_RESTOCK:${settlementId}`;
    const existingMessage = await tx.playerMessage.findUnique({
      where: {
        playerId_dedupeKey: { playerId, dedupeKey },
      },
    });
    if (!existingMessage) {
      const buildingNameLabel = buildingName?.trim() || 'warehouse';
      const productTemplateIds = [
        ...new Set(linesWithReturns.map((l) => l.productTemplateId)),
      ];
      const templates =
        productTemplateIds.length > 0
          ? await tx.productTemplate.findMany({
              where: { id: { in: productTemplateIds } },
              select: { id: true, code: true, name: true },
            })
          : [];
      const templateById = new Map(templates.map((t) => [t.id, t]));

      const sortedLines = [...linesWithReturns].sort(
        (a, b) => b.returnQty - a.returnQty
      );
      const topLines = sortedLines.slice(0, 8);
      const bulletLines = topLines.map((line) => {
        const t = templateById.get(line.productTemplateId);
        const name = t?.name ?? 'Unknown';
        const code = t?.code ?? line.productTemplateId;
        return `• ${name} (${code}) — ${line.returnQty}`;
      });
      const remainingCount = sortedLines.length - 8;
      const trailer =
        remainingCount > 0 ? `\n… and ${remainingCount} more items.` : '';
      const returnedItemsSection =
        bulletLines.length > 0
          ? `\n\nReturned items:\n${bulletLines.join('\n')}${trailer}`
          : '';

      const body = `${totalReturnedUnits} units returned and added back to ${buildingNameLabel} stock.${returnedItemsSection}`;

      await tx.playerMessage.create({
        data: {
          playerId,
          category: MessageCategory.OPERATION,
          department: DepartmentCode.LOGISTICS,
          level: MessageLevel.INFO,
          kind: MessageKind.INFO,
          title: 'Returns processed',
          body,
          context: { buildingId: warehouseBuildingId, settlementId },
          meta: { totalReturnedUnits, buildingId: warehouseBuildingId, settlementId },
          dedupeKey,
        },
      });
    }
  }

  return { totalReturnedUnits };
}
