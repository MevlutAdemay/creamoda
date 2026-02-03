/**
 * Build and post Modaverse settlement (V02) for a warehouse and payout day.
 * Creates ModaverseSettlement + lines (explicit snapshot columns), posts payout to ledger/wallet.
 * Uses PlatformFeeLevelConfig + ShippingProfileFeeConfig; deterministic return rate per (settlementId, productTemplateId).
 */

import prisma from '@/lib/prisma';
import { getPeriodForPayoutDayKey, formatDayKeyString } from '@/lib/game/game-clock';
import { postLedgerEntryAndUpdateWallet } from '@/lib/finance/helpers';
import {
  FinanceDirection,
  FinanceCategory,
  FinanceScopeType,
  FinanceCounterpartyType,
} from '@prisma/client';
import type { PostLedgerEntryPayload } from '@/lib/finance/helpers';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ShippingProfile,
  MetricType,
  MessageCategory,
  MessageLevel,
  MessageKind,
  DepartmentCode,
} from '@prisma/client';
import { applyModaverseReturnsToInventory } from '@/lib/game/apply-modaverse-returns-to-inventory';

const DEFAULT_SHIPPING_PROFILE = ShippingProfile.MEDIUM;

/** Deterministic float in [0, 1] from seed string (hash to float). Same seed => same result. */
function seededFloat(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h = h >>> 0;
  }
  return (h % 0x8000_0000) / 0x8000_0000;
}

/** Deterministic return rate in [min, max] from seed (settlementId + productTemplateId). */
function seededReturnRate(seed: string, min: number, max: number): number {
  const t = seededFloat(seed);
  return min + t * (max - min);
}

export interface BuildAndPostSettlementResult {
  settlementId: string;
  /** Present only when isNew is true (we just posted); not stored on settlement. */
  postedLedgerEntryId?: string;
  totalNetUsd: Decimal;
  isNew: boolean;
}

/**
 * Build settlement for the period corresponding to payoutDayKey (5th or 20th) and post ledger + wallet.
 * Idempotent: if settlement already exists for (companyId, warehouseBuildingId, periodStartDayKey, periodEndDayKey), returns existing.
 */
export async function buildAndPostSettlement(
  companyId: string,
  warehouseBuildingId: string,
  payoutDayKey: Date
): Promise<BuildAndPostSettlementResult | null> {
  const period = getPeriodForPayoutDayKey(payoutDayKey);
  if (!period) return null;

  const { periodStartDayKey, periodEndDayKey } = period;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { playerId: true },
  });
  if (!company?.playerId) return null;

  type PhaseBPayload = {
    settlementId: string;
    playerId: string;
    warehouseBuildingId: string;
    periodStartDayKey: Date;
    periodEndDayKey: Date;
    payoutDayKey: Date;
  };

  const txReturn = await prisma.$transaction(async (tx) => {
    const existing = await tx.modaverseSettlement.findUnique({
      where: {
        companyId_warehouseBuildingId_periodStartDayKey_periodEndDayKey: {
          companyId,
          warehouseBuildingId,
          periodStartDayKey,
          periodEndDayKey,
        },
      },
      include: { lines: true },
    });

    if (existing) {
      const lines = existing.lines;
      return {
        result: {
          settlementId: existing.id,
          totalNetUsd: lines.reduce((sum, l) => sum.add(l.netRevenueUsd), new Decimal(0)),
          isNew: false,
        },
        phaseBPayload: null as PhaseBPayload | null,
      };
    }

    const orders = await tx.modaverseOrder.findMany({
      where: {
        warehouseBuildingId,
        companyId,
        dayKey: { gte: periodStartDayKey, lte: periodEndDayKey },
      },
      include: { items: true },
    });

    const aggregatedByProduct = new Map<
      string,
      { fulfilledQty: number; grossRevenueUsd: Decimal; salePriceUsd: Decimal; listingId: string | null }
    >();

    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productTemplateId;
        const fulfilled = item.qtyFulfilled;
        const price = item.salePriceUsd ?? new Decimal(0);
        const lineGross = price.mul(fulfilled);

        const existing = aggregatedByProduct.get(key);
        if (existing) {
          existing.fulfilledQty += fulfilled;
          existing.grossRevenueUsd = existing.grossRevenueUsd.add(lineGross);
          existing.salePriceUsd = price;
          existing.listingId = item.listingId ?? existing.listingId;
        } else {
          aggregatedByProduct.set(key, {
            fulfilledQty: fulfilled,
            grossRevenueUsd: lineGross,
            salePriceUsd: price,
            listingId: item.listingId,
          });
        }
      }
    }

    if (aggregatedByProduct.size === 0) {
      return { result: null, phaseBPayload: null as PhaseBPayload | null };
    }

    const settlement = await tx.modaverseSettlement.create({
      data: {
        companyId,
        warehouseBuildingId,
        periodStartDayKey,
        periodEndDayKey,
        payoutDayKey,
      },
    });

    const warehouseLevelState = await tx.buildingMetricState.findUnique({
      where: {
        buildingId_metricType: {
          buildingId: warehouseBuildingId,
          metricType: MetricType.SALES_COUNT,
        },
      },
      select: { currentLevel: true },
    });
    const warehouseLevel = warehouseLevelState?.currentLevel ?? 1;

    const levelConfigs = await (tx as any).platformFeeLevelConfig.findMany({
      where: {
        isActive: true,
        levelMin: { lte: warehouseLevel },
        levelMax: { gte: warehouseLevel },
      },
      orderBy: { levelMin: 'asc' },
      take: 1,
    });
    const levelConfig = levelConfigs[0];

    const shippingConfigs = await (tx as any).shippingProfileFeeConfig.findMany({
      where: { isActive: true },
      select: { shippingProfile: true, baseUnitFeeUsd: true },
    });
    const shippingConfigMap = new Map<
      ShippingProfile,
      Decimal
    >(
      shippingConfigs.map((c: { shippingProfile: ShippingProfile; baseUnitFeeUsd: Decimal }) => [
        c.shippingProfile,
        c.baseUnitFeeUsd,
      ])
    );

    const productIds = Array.from(aggregatedByProduct.keys());
    const templates = await tx.productTemplate.findMany({
      where: { id: { in: productIds } },
      select: { id: true, shippingProfile: true },
    });
    const templateMap = new Map(templates.map((t) => [t.id, t]));

    const commissionRate = levelConfig
      ? levelConfig.commissionRate
      : new Decimal('0.10');
    const logisticsMultiplier = levelConfig
      ? levelConfig.logisticsMultiplier
      : new Decimal('1');
    const returnRateMin = levelConfig
      ? Number(levelConfig.returnRateMin)
      : 0.02;
    const returnRateMax = levelConfig
      ? Number(levelConfig.returnRateMax)
      : 0.05;

    let grossTotal = new Decimal(0);
    let commissionTotal = new Decimal(0);
    let logisticsTotal = new Decimal(0);
    let returnsTotal = new Decimal(0);
    let returnQtyTotal = 0;

    for (const [productTemplateId, agg] of aggregatedByProduct) {
      const template = templateMap.get(productTemplateId);
      const shippingProfile = template?.shippingProfile ?? DEFAULT_SHIPPING_PROFILE;
      const baseUnitFeeUsd =
        shippingConfigMap.get(shippingProfile) ?? new Decimal('1.20');

      const commissionFeeUsd = agg.grossRevenueUsd.mul(commissionRate);
      const logisticsUnitFeeUsd = new Decimal(baseUnitFeeUsd).mul(logisticsMultiplier);
      const logisticsFeeUsd = logisticsUnitFeeUsd.mul(agg.fulfilledQty);

      const returnSeed = `${settlement.id}:${productTemplateId}`;
      const returnRateNum = seededReturnRate(returnSeed, returnRateMin, returnRateMax);
      const returnRateSnapshot = new Decimal(returnRateNum.toFixed(4));
      const returnQty = Math.min(
        agg.fulfilledQty,
        Math.ceil(agg.fulfilledQty * returnRateNum)
      );
      const returnDeductionUsd = agg.salePriceUsd.mul(returnQty);

      const netRevenueUsd = agg.grossRevenueUsd
        .sub(commissionFeeUsd)
        .sub(logisticsFeeUsd)
        .sub(returnDeductionUsd);

      grossTotal = grossTotal.add(agg.grossRevenueUsd);
      commissionTotal = commissionTotal.add(commissionFeeUsd);
      logisticsTotal = logisticsTotal.add(logisticsFeeUsd);
      returnsTotal = returnsTotal.add(returnDeductionUsd);
      returnQtyTotal += returnQty;

      await tx.modaverseSettlementLine.create({
        data: {
          settlementId: settlement.id,
          productTemplateId,
          listingId: agg.listingId,
          fulfilledQty: agg.fulfilledQty,
          salePriceUsd: agg.salePriceUsd,
          grossRevenueUsd: agg.grossRevenueUsd,
          commissionRateSnapshot: commissionRate,
          commissionFeeUsd,
          shippingProfileSnapshot: shippingProfile,
          logisticsUnitFeeUsd,
          logisticsFeeUsd,
          returnRateSnapshot,
          returnQty,
          returnDeductionUsd,
          netRevenueUsd,
          tierSnapshot: String(warehouseLevel),
          logisticsCountryFactor: 1,
        },
      });
    }

    const totalNetUsd = grossTotal.sub(commissionTotal).sub(logisticsTotal).sub(returnsTotal);

    const basePayload = {
      companyId,
      dayKey: payoutDayKey,
      category: FinanceCategory.OTHER,
      scopeType: FinanceScopeType.BUILDING,
      scopeId: warehouseBuildingId,
      counterpartyType: FinanceCounterpartyType.MARKETPLACE,
      counterpartyId: null as string | null,
      refType: 'MODAVERSE_SETTLEMENT' as const,
      refId: settlement.id,
    };

    const entriesToPost: PostLedgerEntryPayload[] = [];
    if (grossTotal.gt(0)) {
      entriesToPost.push({
        ...basePayload,
        direction: FinanceDirection.IN,
        amountUsd: grossTotal,
        idempotencyKey: `MODAVERSE_SETTLEMENT:GROSS:${settlement.id}`,
        note: 'Modaverse gross revenue',
      });
    }
    if (commissionTotal.gt(0)) {
      entriesToPost.push({
        ...basePayload,
        direction: FinanceDirection.OUT,
        amountUsd: commissionTotal,
        idempotencyKey: `MODAVERSE_SETTLEMENT:COMMISSION:${settlement.id}`,
        note: 'Modaverse commission fees',
      });
    }
    if (logisticsTotal.gt(0)) {
      entriesToPost.push({
        ...basePayload,
        direction: FinanceDirection.OUT,
        amountUsd: logisticsTotal,
        idempotencyKey: `MODAVERSE_SETTLEMENT:LOGISTICS:${settlement.id}`,
        note: 'Modaverse logistics fees',
      });
    }
    if (returnsTotal.gt(0)) {
      entriesToPost.push({
        ...basePayload,
        direction: FinanceDirection.OUT,
        amountUsd: returnsTotal,
        idempotencyKey: `MODAVERSE_SETTLEMENT:RETURNS:${settlement.id}`,
        note: 'Modaverse returns deduction',
      });
    }

    let grossEntryId: string | undefined;
    for (const payload of entriesToPost) {
      const ledgerResult = await postLedgerEntryAndUpdateWallet(
        tx,
        company.playerId,
        payload
      );
      if (payload.idempotencyKey === `MODAVERSE_SETTLEMENT:GROSS:${settlement.id}`) {
        grossEntryId = ledgerResult.entry.id;
      }
    }

    await applyModaverseReturnsToInventory(tx, {
      companyId,
      warehouseBuildingId,
      settlementId: settlement.id,
      payoutDayKey,
      playerId: company.playerId,
    });

    return {
      result: {
        settlementId: settlement.id,
        postedLedgerEntryId: grossEntryId,
        totalNetUsd,
        isNew: true,
      },
      phaseBPayload: {
        settlementId: settlement.id,
        playerId: company.playerId,
        warehouseBuildingId,
        periodStartDayKey,
        periodEndDayKey,
        payoutDayKey,
      } satisfies PhaseBPayload,
    };
  });

  const result = txReturn.result;
  const payload = txReturn.phaseBPayload;
  if (payload) {
    try {
      const lines = await prisma.modaverseSettlementLine.findMany({
        where: { settlementId: payload.settlementId },
        select: {
          fulfilledQty: true,
          returnQty: true,
          grossRevenueUsd: true,
          commissionFeeUsd: true,
          logisticsFeeUsd: true,
          returnDeductionUsd: true,
          netRevenueUsd: true,
          productTemplateId: true,
        },
      });

      const grossTotal = lines.reduce((s, l) => s.add(l.grossRevenueUsd), new Decimal(0));
      const commissionTotal = lines.reduce((s, l) => s.add(l.commissionFeeUsd), new Decimal(0));
      const logisticsTotal = lines.reduce((s, l) => s.add(l.logisticsFeeUsd), new Decimal(0));
      const returnsTotal = lines.reduce((s, l) => s.add(l.returnDeductionUsd), new Decimal(0));
      const netTotal = lines.reduce((s, l) => s.add(l.netRevenueUsd), new Decimal(0));
      const returnQtyTotal = lines.reduce((s, l) => s + l.returnQty, 0);

      const periodStartStr = formatDayKeyString(payload.periodStartDayKey);
      const periodEndStr = formatDayKeyString(payload.periodEndDayKey);
      const payoutMessageDedupe = `SETTLEMENT_PAYOUT_MESSAGE:${payload.settlementId}`;
      const existingPayoutMsg = await prisma.playerMessage.findUnique({
        where: {
          playerId_dedupeKey: { playerId: payload.playerId, dedupeKey: payoutMessageDedupe },
        },
      });
      if (!existingPayoutMsg) {
        const bodyParts = [
          `Settlement period: ${periodStartStr} → ${periodEndStr}`,
          `Gross sales revenue: ${grossTotal.toFixed(2)} USD`,
          `Commission: ${commissionTotal.toFixed(2)} USD`,
          `Logistics total cost: ${logisticsTotal.toFixed(2)} USD`,
          `Returned units: ${returnQtyTotal}`,
          `Return deduction: ${returnsTotal.toFixed(2)} USD`,
          `Net payout credited: ${netTotal.toFixed(2)} USD`,
        ];
        await prisma.playerMessage.create({
          data: {
            playerId: payload.playerId,
            category: MessageCategory.OPERATION,
            department: DepartmentCode.FINANCE,
            level: MessageLevel.INFO,
            kind: MessageKind.INFO,
            title: 'Settlement completed – payout received',
            body: bodyParts.join('\n'),
            context: {
              settlementId: payload.settlementId,
              warehouseBuildingId: payload.warehouseBuildingId,
              periodStartDayKey: periodStartStr,
              periodEndDayKey: periodEndStr,
              payoutDayKey: formatDayKeyString(payload.payoutDayKey),
            },
            dedupeKey: payoutMessageDedupe,
          },
        });
      }

      const lineProductIds = [...new Set(lines.map((l) => l.productTemplateId))];
      const lineTemplates =
        lineProductIds.length > 0
          ? await prisma.productTemplate.findMany({
              where: { id: { in: lineProductIds } },
              select: { id: true, categoryL3Id: true },
            })
          : [];
      const l3Ids = [...new Set(lineTemplates.map((t) => t.categoryL3Id))];
      const nodesL3 =
        l3Ids.length > 0
          ? await prisma.productCategoryNode.findMany({
              where: { id: { in: l3Ids } },
              select: { id: true, parentId: true },
            })
          : [];
      const l2Ids = [...new Set(nodesL3.map((n) => n.parentId).filter(Boolean) as string[])];
      const nodesL2 =
        l2Ids.length > 0
          ? await prisma.productCategoryNode.findMany({
              where: { id: { in: l2Ids } },
              select: { id: true, name: true },
            })
          : [];
      const l3ToL2 = new Map(
        nodesL3.map((n) => [n.id, n.parentId]).filter(([, p]) => !!p) as [string, string][]
      );
      const templateById = new Map(lineTemplates.map((t) => [t.id, t]));
      const l2Agg = new Map<string, { fulfilledQty: number; returnQty: number }>();
      for (const line of lines) {
        const template = templateById.get(line.productTemplateId);
        const l2Id = template?.categoryL3Id ? l3ToL2.get(template.categoryL3Id) : undefined;
        if (!l2Id) continue;
        const cur = l2Agg.get(l2Id) ?? { fulfilledQty: 0, returnQty: 0 };
        cur.fulfilledQty += line.fulfilledQty;
        cur.returnQty += line.returnQty;
        l2Agg.set(l2Id, cur);
      }
      const highRiskL2 = Array.from(l2Agg.entries())
        .map(([l2Id, v]) => ({
          categoryId: l2Id,
          categoryName: nodesL2.find((n) => n.id === l2Id)?.name ?? l2Id,
          fulfilledQty: v.fulfilledQty,
          returnQty: v.returnQty,
          returnRate: v.fulfilledQty > 0 ? v.returnQty / v.fulfilledQty : 0,
        }))
        .filter((c) => c.returnRate >= 0.1 && c.fulfilledQty >= 20);

      const highRiskDedupe = `HIGH_RETURN_RISK:${payload.settlementId}`;
      const existingHighRiskMsg = await prisma.playerMessage.findUnique({
        where: {
          playerId_dedupeKey: { playerId: payload.playerId, dedupeKey: highRiskDedupe },
        },
      });
      if (highRiskL2.length > 0 && !existingHighRiskMsg) {
        const bodyLines = highRiskL2.map(
          (c) =>
            `• ${c.categoryName}: ${(c.returnRate * 100).toFixed(1)}% return rate, ${c.fulfilledQty} fulfilled units`
        );
        const body =
          'The following categories show high return rates for this settlement period. Consider reviewing product fit or quality.\n\n' +
          bodyLines.join('\n');
        await prisma.playerMessage.create({
          data: {
            playerId: payload.playerId,
            category: MessageCategory.OPERATION,
            department: DepartmentCode.LOGISTICS,
            level: MessageLevel.WARNING,
            kind: MessageKind.INFO,
            title: 'High return risk detected',
            body,
            context: {
              settlementId: payload.settlementId,
              warehouseBuildingId: payload.warehouseBuildingId,
              categories: highRiskL2.map((c) => ({
                categoryId: c.categoryId,
                categoryName: c.categoryName,
                returnRate: c.returnRate,
                fulfilledQty: c.fulfilledQty,
              })),
            },
            dedupeKey: highRiskDedupe,
          },
        });
      }
    } catch (phaseBError) {
      console.error('[build-and-post-settlement] Phase B (inbox/analytics) failed:', phaseBError);
    }
  }

  return result;
}
