/**
 * Build and post Modaverse settlement (V02) for a warehouse and payout day.
 * Creates ModaverseSettlement + lines (explicit snapshot columns), posts payout to ledger/wallet.
 * Uses PlatformFeeLevelConfig + ShippingProfileFeeConfig; deterministic return rate per (settlementId, productTemplateId).
 */

import prisma from '@/lib/prisma';
import { getPeriodForPayoutDayKey } from '@/lib/game/game-clock';
import { postLedgerEntryAndUpdateWallet } from '@/lib/finance/helpers';
import {
  FinanceDirection,
  FinanceCategory,
  FinanceScopeType,
  FinanceCounterpartyType,
} from '@prisma/client';
import type { PostLedgerEntryPayload } from '@/lib/finance/helpers';
import { Decimal } from '@prisma/client/runtime/library';
import { ShippingProfile, MetricType } from '@prisma/client';

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

  let result: BuildAndPostSettlementResult | null = null;

  await prisma.$transaction(async (tx) => {
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
      result = {
        settlementId: existing.id,
        totalNetUsd: lines.reduce((sum, l) => sum.add(l.netRevenueUsd), new Decimal(0)),
        isNew: false,
      };
      return;
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
      result = null;
      return;
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

    result = {
      settlementId: settlement.id,
      postedLedgerEntryId: grossEntryId,
      totalNetUsd,
      isNew: true,
    };
  });

  return result;
}
