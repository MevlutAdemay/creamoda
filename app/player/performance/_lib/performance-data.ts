/**
 * Server-side data aggregation for Product Performance list.
 * Scoped by warehouseBuildingId. Uses product_sales_band_configs for scoring.
 */

import prisma from '@/lib/prisma';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { getWeekIndex0FromDayKey } from '@/lib/game/season-score';
import { ListingStatus, type MarketZone } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  computePerformanceScoreFromBand,
  type PerformanceListRow,
  type BandConfigForScore,
} from './product-performance';
import { getSalesBandEvaluation } from './detail-data';

const SALES_DAYS = 30;

function toNum(d: Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

/**
 * Season potential until first score===0 (wrap scan). Returns expectedSold and expectedLeftover.
 * Returns null when weeksJson missing/invalid; otherwise handles baseQty 0 and out-of-season.
 */
function computeSeasonExpected(
  weeksJson: unknown,
  baseDaily: number,
  currentWeekIndex0: number,
  stockNow: number
): { expectedSold: number; expectedLeftover: number } | null {
  if (!Array.isArray(weeksJson) || weeksJson.length < 52) return null;
  const weeks = weeksJson as number[];
  if (baseDaily <= 0) return { expectedSold: 0, expectedLeftover: stockNow };
  if (Number(weeks[currentWeekIndex0] ?? 0) === 0) return { expectedSold: 0, expectedLeftover: stockNow };
  let potentialUnits = 0;
  for (let step = 0; step < 52; step++) {
    const w = (currentWeekIndex0 + step) % 52;
    if (Number(weeks[w] ?? 0) === 0) break;
    potentialUnits += baseDaily * 7 * (Number(weeks[w] ?? 0) / 100);
  }
  const expectedSold = Math.min(stockNow, potentialUnits);
  const expectedLeftover = Math.max(0, stockNow - potentialUnits);
  return { expectedSold, expectedLeftover };
}

/** Find band by bandCategoryId (L2 from category node parent), productQuality, tier. Configs are keyed by L2. */
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

export async function getPerformanceListData(
  companyId: string,
  warehouseBuildingId: string
): Promise<PerformanceListRow[]> {
  const currentDayKey = await getCompanyGameDayKey(companyId);
  const currentWeekIndex0 = getWeekIndex0FromDayKey(currentDayKey);
  const endDay = new Date(currentDayKey);
  const startDay = new Date(currentDayKey);
  startDay.setUTCDate(startDay.getUTCDate() - SALES_DAYS);

  const [listings, salesAgg, inventory, bandConfigs, metricState] = await Promise.all([
    prisma.showcaseListing.findMany({
      where: {
        companyId,
        warehouseBuildingId,
        status: { in: [ListingStatus.LISTED, ListingStatus.PAUSED] },
      },
      select: {
        id: true,
        playerProductId: true,
        marketZone: true,
        baseQty: true,
        seasonScore: true,
        salePrice: true,
        playerProduct: {
          select: {
            productTemplate: {
              select: {
                name: true,
                categoryL3Id: true,
                productQuality: true,
                baseCost: true,
                seasonScenarioDefinitionId: true,
                productImageTemplates: {
                  where: { slot: 'MAIN' },
                  take: 1,
                  select: { url: true, alt: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.dailyProductSalesLog.groupBy({
      by: ['playerProductId'],
      where: {
        companyId,
        warehouseBuildingId,
        dayKey: { gte: startDay, lte: endDay },
      },
      _sum: { qtyShipped: true, qtyReturned: true },
      _avg: { grossProfit: true, grossRevenue: true },
      _count: { dayKey: true },
    }),
    prisma.buildingInventoryItem.findMany({
      where: { companyBuildingId: warehouseBuildingId, isArchived: false },
      select: { playerProductId: true, qtyOnHand: true },
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
    prisma.buildingMetricState.findUnique({
      where: {
        buildingId_metricType: {
          buildingId: warehouseBuildingId,
          metricType: 'SALES_COUNT',
        },
      },
      select: { currentLevel: true },
    }),
  ]);

  const warehouseTier = Math.min(5, Math.max(1, metricState?.currentLevel ?? 1));

  const l3Ids = [...new Set(listings.map((l) => l.playerProduct?.productTemplate?.categoryL3Id).filter(Boolean))] as string[];
  const categoryNodes = l3Ids.length > 0
    ? await prisma.productCategoryNode.findMany({
        where: { id: { in: l3Ids } },
        select: { id: true, level: true, parentId: true },
      })
    : [];
  const l3ToBandCategoryId = new Map<string, string>();
  for (const node of categoryNodes) {
    const bandId = node.level === 'L3' && node.parentId ? node.parentId : node.id;
    l3ToBandCategoryId.set(node.id, bandId);
  }

  // Batch-load season scenarios for unique (definitionId, marketZone) from this warehouse's listings
  const scenarioPairs = new Map<string, { definitionId: string; marketZone: string }>();
  for (const listing of listings) {
    const defId = listing.playerProduct?.productTemplate?.seasonScenarioDefinitionId ?? null;
    const mz = listing.marketZone ?? null;
    if (defId && mz) scenarioPairs.set(`${defId}|${mz}`, { definitionId: defId, marketZone: mz });
  }
  const scenarioRows =
    scenarioPairs.size > 0
      ? await prisma.marketZoneSeasonScenario.findMany({
          where: {
            isActive: true,
            OR: [...scenarioPairs.values()].map((p) => ({
              definitionId: p.definitionId,
              marketZone: p.marketZone as MarketZone,
            })),
          },
          select: { definitionId: true, marketZone: true, weeksJson: true },
        })
      : [];
  const scenarioByKey = new Map(
    scenarioRows.map((r) => [`${r.definitionId}|${r.marketZone}`, r.weeksJson])
  );

  const salesByProduct = new Map(
    salesAgg.map((s) => [
      s.playerProductId,
      {
        totalShipped: s._sum.qtyShipped ?? 0,
        totalReturned: s._sum.qtyReturned ?? 0,
        daysWithData: s._count.dayKey,
        avgGrossProfit: toNum(s._avg.grossProfit),
        avgGrossRevenue: toNum(s._avg.grossRevenue),
      },
    ])
  );

  const stockByProduct = new Map(
    inventory
      .filter((i) => i.playerProductId != null)
      .map((i) => [i.playerProductId!, { qtyOnHand: i.qtyOnHand }])
  );

  const rows: PerformanceListRow[] = [];

  for (const listing of listings) {
    const pp = listing.playerProduct;
    const template = pp?.productTemplate;
    const productName = template?.name ?? 'Unknown';
    const mainImage = template?.productImageTemplates?.[0];
    const productImageUrl = mainImage?.url ?? null;
    const productImageAlt = mainImage?.alt ?? null;
    const categoryL3Id = template?.categoryL3Id ?? '';
    const productQuality = template?.productQuality ?? 'STANDARD';

    const sales = salesByProduct.get(listing.playerProductId) ?? {
      totalShipped: 0,
      totalReturned: 0,
      daysWithData: 0,
      avgGrossProfit: 0,
      avgGrossRevenue: 0,
    };
    const stock = stockByProduct.get(listing.playerProductId)?.qtyOnHand ?? 0;
    const daysWithData = Math.max(1, Math.min(SALES_DAYS, sales.daysWithData));
    const avgDailySales = sales.totalShipped / daysWithData;
    const avgRevenue = sales.avgGrossRevenue || toNum(listing.salePrice) * avgDailySales;
    const profitMargin = avgRevenue > 0 ? (sales.avgGrossProfit || 0) / avgRevenue : 0;
    const seasonScore = listing.seasonScore ?? 50;
    const stockDaysRemaining = avgDailySales > 0 ? stock / avgDailySales : null;

    const bandCategoryId = l3ToBandCategoryId.get(categoryL3Id) ?? categoryL3Id;
    const band = findBand(
      bandConfigs as Array<{ categoryL3Id: string; productQuality: string; tierMin: number; tierMax: number; minDaily: number; maxDaily: number; expectedMode: number | null }>,
      bandCategoryId,
      productQuality,
      warehouseTier
    );

    const result = computePerformanceScoreFromBand(
      avgDailySales,
      band,
      stock,
      stockDaysRemaining
    );

    const salesBandEvaluation = band
      ? getSalesBandEvaluation(avgDailySales, band.minDaily, band.maxDaily, undefined)
      : {
          pct: 0,
          label: 'Band not found',
          note: 'Define a sales band for this category/quality.',
          tone: 'warning' as const,
        };

    const definitionId = template?.seasonScenarioDefinitionId ?? null;
    const marketZone = listing.marketZone ?? null;
    const scenarioKey = definitionId && marketZone ? `${definitionId}|${marketZone}` : null;
    const weeksJson = scenarioKey ? scenarioByKey.get(scenarioKey) : null;
    const baseDaily = listing.baseQty ?? 0;
    const seasonExpected = computeSeasonExpected(
      weeksJson ?? null,
      baseDaily,
      currentWeekIndex0,
      stock
    );
    const expectedSoldSeason = seasonExpected?.expectedSold ?? null;
    const expectedLeftoverSeason = seasonExpected?.expectedLeftover ?? null;

    rows.push({
      playerProductId: listing.playerProductId,
      productName,
      productImageUrl,
      productImageAlt,
      label: result.label,
      salesBandEvaluation,
      _score: result.score,
      _avgDailySales: avgDailySales,
      _profitMargin: profitMargin,
      _stockDaysRemaining: stockDaysRemaining,
      _seasonScore: seasonScore,
      listingId: listing.id,
      marketZone: listing.marketZone,
      expectedSoldSeason,
      expectedLeftoverSeason,
    });
  }

  return rows;
}

export type { PerformanceListRow };
