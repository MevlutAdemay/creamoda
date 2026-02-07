/**
 * Server-side data for Product Performance detail page.
 * Uses product_sales_band_configs and market_zone_season_scenarios.
 * Price evaluation uses existing ShowcaseListing.priceIndex and blockedByPrice (no recomputation).
 */

import prisma from '@/lib/prisma';

/** Pure helper: interpret stored priceIndex + blockedByPrice as a short label and tone. No numbers shown to player. */
export function getPriceEvaluation(
  priceIndex: number,
  blockedByPrice: boolean
): { label: string; tone: 'danger' | 'warning' | 'neutral' | 'positive' } {
  if (blockedByPrice || priceIndex > 1.15) {
    return {
      label: 'Price is well above market. Demand is not forming.',
      tone: 'danger',
    };
  }
  if (priceIndex > 1.1) {
    return {
      label: 'Price is high. Demand is dropping significantly.',
      tone: 'danger',
    };
  }
  if (priceIndex > 1.05) {
    return {
      label: 'Price is above market average.',
      tone: 'warning',
    };
  }
  if (priceIndex > 0.9) {
    return {
      label: 'Price is at market level.',
      tone: 'neutral',
    };
  }
  if (priceIndex > 0.8) {
    return {
      label: 'Competitive price. Demand is rising.',
      tone: 'positive',
    };
  }
  if (priceIndex > 0.7) {
    return {
      label: 'Below-market price. Demand is strong.',
      tone: 'positive',
    };
  }
  return {
    label: 'Very low price. Demand is peaking; margin at risk.',
    tone: 'warning',
  };
}
import { getCompanyGameDayKey, formatDayKeyString } from '@/lib/game/game-clock';
import { getWeekIndex0FromDayKey } from '@/lib/game/season-score';
import { addMonthsUtc, getUtcDayOfYear } from '@/lib/game/date-utils';
import { BuildingRole, ListingStatus } from '@prisma/client';
import type { MarketZone } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  computePerformanceScoreFromBand,
  type BandConfigForScore,
  type PerformanceLabel,
} from './product-performance';

const SALES_DAYS = 30;
const SALES_DAYS_7 = 7;

function toNum(d: Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

function deriveTierUsed(
  logs: { tierUsed: number | null; reasonsSnapshot: unknown }[]
): number {
  if (logs.length === 0) return 1;
  const withSnap = logs.filter((l) => l.reasonsSnapshot && typeof l.reasonsSnapshot === 'object');
  const last = withSnap[withSnap.length - 1];
  const snap = last?.reasonsSnapshot as { tierUsed?: number } | undefined;
  if (typeof snap?.tierUsed === 'number') return Math.min(5, Math.max(1, snap.tierUsed));
  const tiers = logs.map((l) => l.tierUsed).filter((t): t is number => t != null && t >= 1 && t <= 5);
  if (tiers.length === 0) return 1;
  const counts: Record<number, number> = {};
  tiers.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; });
  const mode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return mode != null ? Number(mode) : 1;
}

/**
 * Find band by bandCategoryId (L2 id from category node parent), productQuality, tier.
 * ProductSalesBandConfig is keyed by L2 in our data even though the column is named categoryL3Id.
 */
function findBand(
  bands: Array<{ categoryL3Id: string; productQuality: string; tierMin: number; tierMax: number; minDaily: number; maxDaily: number; expectedMode: number | null }>,
  bandCategoryId: string,
  productQuality: string,
  tierUsed: number
): BandConfigForScore | null {
  const t = Math.min(5, Math.max(1, tierUsed));
  const b = bands.find(
    (x) =>
      x.categoryL3Id === bandCategoryId &&
      x.productQuality === productQuality &&
      x.tierMin <= t &&
      x.tierMax >= t
  );
  return b ? { minDaily: b.minDaily, maxDaily: b.maxDaily, expectedMode: b.expectedMode } : null;
}

/**
 * Pure helper: interpret avg daily sales vs band (min/max) as pct, label, note, tone.
 * Uses ProductSalesBandConfig semantics; no fixed weights.
 */
export function getSalesBandEvaluation(
  avgDaily: number,
  minDaily: number,
  maxDaily: number,
  playerLevel?: number
): {
  pct: number;
  label: string;
  note: string;
  tone: 'danger' | 'warning' | 'neutral' | 'success';
} {
  const supportive = playerLevel != null && playerLevel <= 3;
  let pct: number;
  if (maxDaily === minDaily) {
    pct = avgDaily >= maxDaily ? 100 : 0;
  } else {
    pct = Math.max(0, Math.min(1, (avgDaily - minDaily) / (maxDaily - minDaily))) * 100;
  }

  if (avgDaily <= minDaily) {
    return {
      pct: Math.round(pct),
      label: 'Weak',
      note: supportive
        ? 'Below band. Review price, season or visibility.'
        : 'Below-band sales. Check price / season / visibility.',
      tone: 'danger',
    };
  }
  if (avgDaily > maxDaily || pct >= 100) {
    return {
      pct: 100,
      label: 'Super',
      note: 'Above-band performance.',
      tone: 'success',
    };
  }
  if (pct < 35) {
    return {
      pct: Math.round(pct),
      label: 'Bad',
      note: supportive
        ? 'Below band. Small improvements can make a difference.'
        : 'Below band. Review price or campaign.',
      tone: 'danger',
    };
  }
  if (pct < 70) {
    return {
      pct: Math.round(pct),
      label: 'Good',
      note: supportive
        ? 'Within band. Some optimization still possible.'
        : 'Within band. Stable performance.',
      tone: 'neutral',
    };
  }
  if (pct < 95) {
    return {
      pct: Math.round(pct),
      label: 'Very good',
      note: 'In the upper segment of the band.',
      tone: 'success',
    };
  }
  return {
    pct: Math.round(pct),
    label: 'Super',
    note: 'Above-band performance.',
    tone: 'success',
  };
}

/** Next 6 periods of 4 weeks each (monthly), starting from current week. Returns 6 scores 0..100. */
function next6MonthlyScoresFromWeeksJson(weeksJson: number[], currentWeekIndex0: number): number[] {
  const weeks = Array.isArray(weeksJson) ? weeksJson : [];
  const out: number[] = [];
  for (let p = 0; p < 6; p++) {
    let sum = 0;
    for (let w = 0; w < 4; w++) {
      const idx = (currentWeekIndex0 + p * 4 + w) % 52;
      sum += Number(weeks[idx] ?? 50);
    }
    out.push(Math.min(100, Math.max(0, sum / 4)));
  }
  return out;
}

export type PerformanceDetailData = {
  playerProductId: string;
  productName: string;
  productImageUrl: string | null;
  productImageAlt: string | null;
  label: PerformanceLabel;
  /** Warehouse context */
  warehouseId: string;
  warehouseLabel: string;
  marketZone: string;
  listingId: string;
  /** BuildingInventoryItem.id for this warehouse+playerProduct; required for price update API */
  inventoryItemId: string | null;
  salePrice: number;
  /** Overview card: only these 4 (+ price evaluation under sale price) */
  stockCount: number;
  salePriceDisplay: number;
  /** From ShowcaseListing (existing data, not recomputed) */
  priceIndex: number | null;
  blockedByPrice: boolean | null;
  /** Interpretive label + tone for display under sale price */
  priceEvaluation: { label: string; tone: 'danger' | 'warning' | 'neutral' | 'positive' };
  /** For band-based sales evaluation */
  productTemplate: { categoryL3Id: string; productQuality: string };
  currentTier: number;
  salesBand: { minDaily: number; maxDaily: number; expectedMode: number | null } | null;
  salesBandEvaluation: {
    pct: number;
    label: string;
    note: string;
    tone: 'danger' | 'warning' | 'neutral' | 'success';
  };
  avgDailySales30: number;
  performanceNotes: string;
  /** Sales Performance card */
  avgDailySales7: number;
  avgDailySales30ForSales: number;
  sales7vs30PctDiff: number | null;
  expectedMode: number | null;
  expectedVsActualLine: string;
  returnRatePct: number | null;
  /** Marketing Impact card */
  activeCampaignsCount: number;
  last7dSpendOrTotalSnapshot: number;
  marketingNote: string;
  /** Forecast card (includes stock) */
  forecastOutlook: 'Strong' | 'Neutral' | 'Weak';
  forecastPeakMonthIndex: number; // 0..5
  forecastPeakMonthScore: number;
  stockDaysLeft: number;
  willStockEndBeforePeakNote: string;
  /** Season remaining sales potential (baseQty + weeksJson until first zero). Omitted if no curve. */
  seasonRemaining?: {
    weeksRemaining: number;
    potentialUnits: number;
    expectedSold: number;
    expectedRemaining: number;
    endWeekIndex0: number | null;
    /** true when current week score === 0 */
    outOfSeason?: boolean;
    /** true when baseQty is null/0 */
    noDemandEstimate?: boolean;
    /** Up to 6 months (4-week periods); stop at first zero. */
    forecastMonths: Array<{
      label: string;
      scoreAvg: number;
      potentialUnits: number;
      weeksCount: number;
    }>;
    /** First month index where cumulative potential >= stockNow; null if stock covers season. */
    stockoutMonthIndex: number | null;
    /** Dev only: verify week alignment (wrap + first zero). */
    _seasonDebug?: {
      currentDayKey: string;
      computedDayOfYear: number;
      currentWeekIndex0: number;
      firstZeroStep: number | null;
      firstZeroWeekIndex0: number | null;
    };
  };
  /** For warehouse selector */
  warehouses: Array<{ id: string; label: string }>;
  /** Current game day (YYYY-MM-DD) for campaign modal */
  currentDayKey: string;
  /** Dev only: band lookup debug */
  _debug?: {
    templateCategoryId: string;
    bandCategoryId: string;
    nodeLevel: string | null;
    nodeParentId: string | null;
  };
};

export async function getPerformanceDetailData(
  companyId: string,
  playerProductId: string,
  warehouseId: string | null
): Promise<PerformanceDetailData | null> {
  const currentDayKey = await getCompanyGameDayKey(companyId);
  const endDay = new Date(currentDayKey);
  const startDay = new Date(currentDayKey);
  startDay.setUTCDate(startDay.getUTCDate() - SALES_DAYS);

  const warehouses = await prisma.companyBuilding.findMany({
    where: { companyId, role: BuildingRole.WAREHOUSE },
    select: { id: true, marketZone: true },
    orderBy: { createdAt: 'asc' },
  });
  const warehouseList = warehouses.map((w) => ({
    id: w.id,
    label: w.marketZone ? `Warehouse – ${w.marketZone.replace(/_/g, ' ')}` : 'Warehouse',
  }));

  const resolvedWarehouseId =
    warehouseId && warehouses.some((w) => w.id === warehouseId)
      ? warehouseId
      : warehouses[0]?.id ?? null;
  if (!resolvedWarehouseId) return null;

  const listing = await prisma.showcaseListing.findFirst({
    where: {
      companyId,
      playerProductId,
      warehouseBuildingId: resolvedWarehouseId,
      status: { in: [ListingStatus.LISTED, ListingStatus.PAUSED] },
    },
    select: {
      id: true,
      marketZone: true,
      baseQty: true,
      salePrice: true,
      priceIndex: true,
      blockedByPrice: true,
      warehouse: { select: { id: true, marketZone: true } },
    },
  });
  if (!listing) return null;

  const product = await prisma.playerProduct.findUnique({
    where: { id: playerProductId, companyId },
    select: {
      productTemplate: {
        select: {
          name: true,
          categoryL3Id: true,
          productQuality: true,
          seasonScenarioDefinitionId: true,
          productImageTemplates: {
            where: { slot: 'MAIN' },
            take: 1,
            select: { url: true, alt: true },
          },
        },
      },
    },
  });
  if (!product?.productTemplate) return null;

  const template = product.productTemplate;
  const mainImage = template.productImageTemplates?.[0];
  const salePrice = toNum(listing.salePrice);
  const templateCategoryId = template.categoryL3Id ?? '';
  const productQuality = template.productQuality ?? 'STANDARD';
  const definitionId = template.seasonScenarioDefinitionId;

  const [salesLogs, inventory, campaigns, bandConfigs, seasonScenario, categoryNode, metricState] =
    await Promise.all([
    prisma.dailyProductSalesLog.findMany({
      where: {
        companyId,
        playerProductId,
        warehouseBuildingId: resolvedWarehouseId,
        dayKey: { gte: startDay, lte: endDay },
      },
      select: {
        dayKey: true,
        qtyShipped: true,
        qtyReturned: true,
        tierUsed: true,
        reasonsSnapshot: true,
      },
      orderBy: { dayKey: 'asc' },
    }),
    prisma.buildingInventoryItem.findFirst({
      where: {
        companyBuildingId: resolvedWarehouseId,
        playerProductId,
        isArchived: false,
      },
      select: { id: true, qtyOnHand: true },
    }),
    prisma.productMarketingCampaign.findMany({
      where: { listingId: listing.id },
      select: {
        status: true,
        packagePriceSnapshot: true,
        startDayKey: true,
        endDayKey: true,
      },
    }),
    prisma.productSalesBandConfig.findMany({
      where: { isActive: true },
      select: {
        categoryL3Id: true,
        productQuality: true,
        tierMin: true,
        tierMax: true,
        minDaily: true,
        maxDaily: true,
        expectedMode: true,
      },
    }),
    definitionId && listing.marketZone
      ? prisma.marketZoneSeasonScenario.findUnique({
          where: {
            definitionId_marketZone: {
              definitionId,
              marketZone: listing.marketZone as MarketZone,
            },
            isActive: true,
          },
          select: { weeksJson: true },
        })
      : Promise.resolve(null),
    templateCategoryId
      ? prisma.productCategoryNode.findUnique({
          where: { id: templateCategoryId },
          select: { id: true, level: true, parentId: true },
        })
      : Promise.resolve(null),
    prisma.buildingMetricState.findUnique({
      where: {
        buildingId_metricType: {
          buildingId: resolvedWarehouseId,
          metricType: 'SALES_COUNT',
        },
      },
      select: { currentLevel: true },
    }),
  ]);

  const currentTier = Math.min(5, Math.max(1, metricState?.currentLevel ?? 1));

  const bandCategoryId =
    categoryNode?.level === 'L3' && categoryNode.parentId
      ? categoryNode.parentId
      : templateCategoryId;

  const stockOnHand = inventory?.qtyOnHand ?? 0;
  const totalShipped30 = salesLogs.reduce((s, l) => s + l.qtyShipped, 0);
  const totalReturned30 = salesLogs.reduce((s, l) => s + l.qtyReturned, 0);
  const daysWithData = Math.max(1, salesLogs.length);
  const avgDailySales30 = totalShipped30 / daysWithData;
  const last7 = salesLogs.slice(-7);
  const last7Shipped = last7.reduce((s, l) => s + l.qtyShipped, 0);
  const avgDailySales7 = last7.length > 0 ? last7Shipped / last7.length : avgDailySales30;
  const sales7vs30PctDiff =
    avgDailySales30 > 0 ? ((avgDailySales7 - avgDailySales30) / avgDailySales30) * 100 : null;

  const band = findBand(
    bandConfigs as Array<{ categoryL3Id: string; productQuality: string; tierMin: number; tierMax: number; minDaily: number; maxDaily: number; expectedMode: number | null }>,
    bandCategoryId,
    productQuality,
    currentTier
  );
  const expectedMode = band?.expectedMode ?? (band ? (band.minDaily + band.maxDaily) / 2 : null);
  const stockDaysRemaining = avgDailySales30 > 0 ? stockOnHand / avgDailySales30 : null;
  const scoreResult = computePerformanceScoreFromBand(
    avgDailySales30,
    band,
    stockOnHand,
    stockDaysRemaining
  );

  const expectedVsActualLine =
    expectedMode != null
      ? `Expected ~${expectedMode.toFixed(1)}/day · Actual ${avgDailySales30.toFixed(1)}/day`
      : `Actual ${avgDailySales30.toFixed(1)}/day (no band)`;

  const returnRatePct =
    totalShipped30 > 0 && totalReturned30 > 0
      ? (totalReturned30 / (totalShipped30 + totalReturned30)) * 100
      : null;

  const activeCampaigns = campaigns.filter(
    (c) => c.status === 'ACTIVE' || c.status === 'SCHEDULED'
  );
  const activeCampaignsCount = activeCampaigns.length;
  const last7dSpendOrTotalSnapshot = activeCampaigns.reduce(
    (s, c) => s + toNum(c.packagePriceSnapshot),
    0
  );
  const marketingNote =
    activeCampaignsCount > 0
      ? 'Responds well to ads'
      : 'No active campaign';

  const weeksJson = seasonScenario?.weeksJson;
  const currentWeekIndex0 = getWeekIndex0FromDayKey(currentDayKey);
  const monthlyScores = Array.isArray(weeksJson)
    ? next6MonthlyScoresFromWeeksJson(weeksJson as number[], currentWeekIndex0)
    : [50, 50, 50, 50, 50, 50];
  const avgForecast = monthlyScores.reduce((a, b) => a + b, 0) / 6;
  const forecastOutlook: 'Strong' | 'Neutral' | 'Weak' =
    avgForecast >= 60 ? 'Strong' : avgForecast >= 35 ? 'Neutral' : 'Weak';
  let forecastPeakMonthIndex = 0;
  let forecastPeakMonthScore = monthlyScores[0];
  monthlyScores.forEach((sc, i) => {
    if (sc > forecastPeakMonthScore) {
      forecastPeakMonthScore = sc;
      forecastPeakMonthIndex = i;
    }
  });
  const stockDaysLeft = stockOnHand / Math.max(avgDailySales30, 0.1);
  const daysToPeakApprox = (forecastPeakMonthIndex + 0.5) * 28;
  const willStockEndBeforePeakNote =
    stockDaysLeft < daysToPeakApprox && stockDaysLeft < 365
      ? 'Stock may run out before peak demand'
      : stockDaysLeft >= daysToPeakApprox
        ? 'Stock should cover through peak'
        : 'Peak demand ahead';

  // Season remaining: 6 months (4-week periods), stop at first score===0; baseQty × weeksJson.
  // Scan uses wrap: w = (currentWeekIndex0 + step) % 52 so season can extend past year-end into Feb/Mar.
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let seasonRemaining: PerformanceDetailData['seasonRemaining'] = undefined;
  const baseDaily = listing.baseQty ?? 0;
  const noDemandEstimate = baseDaily <= 0;
  const computedDayOfYear = getUtcDayOfYear(currentDayKey);
  if (Array.isArray(weeksJson) && weeksJson.length >= 52) {
    const weeks = weeksJson as number[];
    const currentScore = Number(weeks[currentWeekIndex0] ?? 0);
    const outOfSeason = currentScore === 0;
    // Find first zero scanning forward with wrap (up to 52 steps).
    let firstZeroStep: number | null = null;
    let firstZeroWeekIndex0: number | null = null;
    for (let step = 0; step < 52; step++) {
      const w = (currentWeekIndex0 + step) % 52;
      if (Number(weeks[w] ?? 0) === 0) {
        firstZeroStep = step;
        firstZeroWeekIndex0 = w;
        break;
      }
    }
    const endWeekIndex0 = firstZeroWeekIndex0;
    const forecastMonths: Array<{ label: string; scoreAvg: number; potentialUnits: number; weeksCount: number }> = [];
    let stopGeneratingMonths = false;

    for (let m = 0; m < 6 && !stopGeneratingMonths; m++) {
      const monthWeekIndices: number[] = [];
      for (let i = 0; i < 4; i++) {
        const step = m * 4 + i;
        if (firstZeroStep !== null && step >= firstZeroStep) {
          stopGeneratingMonths = true;
          break;
        }
        const w = (currentWeekIndex0 + step) % 52;
        const score = Number(weeks[w] ?? 0);
        if (score === 0) {
          stopGeneratingMonths = true;
          break;
        }
        monthWeekIndices.push(w);
      }
      const weeksCount = monthWeekIndices.length;
      const scoresIncluded = monthWeekIndices.map((w) => Number(weeks[w] ?? 0));
      const scoreAvg = weeksCount > 0 ? scoresIncluded.reduce((a, b) => a + b, 0) / weeksCount : 0;
      const potentialUnits =
        baseDaily > 0 && weeksCount > 0 ? baseDaily * (weeksCount * 7) * (scoreAvg / 100) : 0;
      const monthDate = addMonthsUtc(currentDayKey, m);
      const label = SHORT_MONTHS[monthDate.getUTCMonth()] ?? `M${m + 1}`;
      forecastMonths.push({ label, scoreAvg, potentialUnits, weeksCount });
    }
    const weeksRemaining = outOfSeason ? 0 : (firstZeroStep !== null ? firstZeroStep : 52);
    const potentialUnits = forecastMonths.reduce((s, mo) => s + mo.potentialUnits, 0);
    const expectedSold = noDemandEstimate ? 0 : Math.min(stockOnHand, potentialUnits);
    const expectedRemaining = Math.max(0, stockOnHand - potentialUnits);
    let stockoutMonthIndex: number | null = null;
    let cum = 0;
    for (let i = 0; i < forecastMonths.length; i++) {
      cum += forecastMonths[i].potentialUnits;
      if (cum >= stockOnHand) {
        stockoutMonthIndex = i;
        break;
      }
    }
    seasonRemaining = {
      weeksRemaining,
      potentialUnits,
      expectedSold,
      expectedRemaining,
      endWeekIndex0: endWeekIndex0 ?? null,
      forecastMonths,
      stockoutMonthIndex,
      ...(outOfSeason && { outOfSeason: true }),
      ...(noDemandEstimate && { noDemandEstimate: true }),
      ...(process.env.NODE_ENV === 'development' && {
        _seasonDebug: {
          currentDayKey: currentDayKey.toISOString?.() ?? String(currentDayKey),
          computedDayOfYear,
          currentWeekIndex0,
          firstZeroStep,
          firstZeroWeekIndex0,
        },
      }),
    };
  }

  const wh = listing.warehouse;
  const warehouseLabel = wh?.marketZone
    ? `Warehouse – ${String(wh.marketZone).replace(/_/g, ' ')}`
    : 'Warehouse';

  const priceIndex = listing.priceIndex != null ? Number(listing.priceIndex) : null;
  const blockedByPrice = listing.blockedByPrice ?? false;
  const priceEvaluation = getPriceEvaluation(priceIndex ?? 1, blockedByPrice);

  const salesBand: { minDaily: number; maxDaily: number; expectedMode: number | null } | null = band
    ? { minDaily: band.minDaily, maxDaily: band.maxDaily, expectedMode: band.expectedMode }
    : null;
  const salesBandEvaluation = band
    ? getSalesBandEvaluation(avgDailySales30, band.minDaily, band.maxDaily, undefined)
    : {
        pct: 0,
        label: 'Band not found',
        note: 'Define a sales band for this category/quality.',
        tone: 'warning' as const,
      };

  return {
    playerProductId,
    productName: template.name,
    productImageUrl: mainImage?.url ?? null,
    productImageAlt: mainImage?.alt ?? null,
    label: scoreResult.label,
    warehouseId: resolvedWarehouseId,
    warehouseLabel,
    marketZone: listing.marketZone,
    listingId: listing.id,
    inventoryItemId: inventory?.id ?? null,
    salePrice,
    stockCount: stockOnHand,
    salePriceDisplay: salePrice,
    priceIndex,
    blockedByPrice: listing.blockedByPrice,
    priceEvaluation,
    productTemplate: { categoryL3Id: templateCategoryId, productQuality },
    currentTier,
    salesBand,
    salesBandEvaluation,
    avgDailySales30,
    performanceNotes: scoreResult.performanceNotes,
    avgDailySales7,
    avgDailySales30ForSales: avgDailySales30,
    sales7vs30PctDiff,
    expectedMode,
    expectedVsActualLine,
    returnRatePct,
    activeCampaignsCount,
    last7dSpendOrTotalSnapshot,
    marketingNote,
    forecastOutlook,
    forecastPeakMonthIndex,
    forecastPeakMonthScore,
    stockDaysLeft,
    willStockEndBeforePeakNote,
    ...(seasonRemaining !== undefined && { seasonRemaining }),
    warehouses: warehouseList,
    currentDayKey: formatDayKeyString(currentDayKey),
    ...(process.env.NODE_ENV === 'development' && {
      _debug: {
        templateCategoryId,
        bandCategoryId,
        nodeLevel: categoryNode?.level ?? null,
        nodeParentId: categoryNode?.parentId ?? null,
      },
    }),
  };
}
