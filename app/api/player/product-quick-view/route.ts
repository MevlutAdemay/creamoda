// app/api/player/product-quick-view/route.ts
//
// Product Quick View:
// - ProductTemplate details (incl. images)
// - Player balances (XP, Diamond)
// - First warehouse country priceMultiplier for suggested price
// - seasonalityByZone: per-warehouse marketZone, weekly scenario (todayScore, 6 months, peakMonths)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import {
  getUtcDayOfYear,
  getWeekIndexFromDayOfYear,
  addMonthsUtc,
} from '@/lib/game/date-utils';
import type { MarketZone } from '@prisma/client';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const IS_DEV = process.env.NODE_ENV !== 'production';

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && (v as { toNumber?: () => number })?.toNumber)
    return (v as { toNumber: () => number }).toNumber();
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** weeksJson: array of 52 ints (0..100). index 0 = week 1. */
function scoreAtWeek(weeksJson: unknown, weekIndex: number): number {
  const arr = Array.isArray(weeksJson) ? weeksJson : [];
  const i = Math.max(0, Math.min(weekIndex - 1, 51));
  const v = arr[i];
  return clampScore(typeof v === 'number' ? v : Number(v) || 0);
}

export type SeasonalityByZoneItem = {
  marketZone: MarketZone;
  todayScore: number;
  months: { monthIndex: number; label: string; score: number }[];
  peakMonths: string[];
  debug?: { definitionCode: string; foundCurve: boolean; weekIndex: number; dayOfYear: number };
};

async function buildSeasonalityByZone(
  definitionId: string | null,
  definitionCode: string | null,
  warehouseZones: MarketZone[],
  currentDayKey: Date
): Promise<SeasonalityByZoneItem[]> {
  const result: SeasonalityByZoneItem[] = [];
  if (!definitionId || warehouseZones.length === 0) {
    return result;
  }

  const doy = getUtcDayOfYear(currentDayKey);
  const doyClamped = Math.max(1, Math.min(366, doy));
  const weekIndex = getWeekIndexFromDayOfYear(doyClamped);

  // Load curves for all warehouse zones in one query
  const curves = await (prisma as any).marketZoneSeasonScenario.findMany({
    where: {
      definitionId,
      marketZone: { in: warehouseZones },
      isActive: true,
    },
    select: { marketZone: true, weeksJson: true },
  });
  const curveByZone = new Map(
    curves.map((c: { marketZone: MarketZone; weeksJson: unknown }) => [c.marketZone, c.weeksJson])
  );

  for (const marketZone of warehouseZones) {
    const weeksJson = curveByZone.get(marketZone);
    const foundCurve = weeksJson != null;

    const debug =
      IS_DEV
        ? {
            definitionCode: definitionCode ?? '',
            foundCurve,
            weekIndex,
            dayOfYear: doyClamped,
          }
        : undefined;

    if (!foundCurve || !Array.isArray(weeksJson)) {
      result.push({
        marketZone,
        todayScore: 0,
        months: [],
        peakMonths: [],
        ...(debug ? { debug } : {}),
      });
      continue;
    }

    const todayScore = scoreAtWeek(weeksJson, weekIndex);

    // 6 months from current month (game date); monthly average from sample days 1, 8, 15, 22
    const months: { monthIndex: number; label: string; score: number }[] = [];
    const SAMPLE_DAYS = [1, 8, 15, 22];

    for (let i = 0; i < 6; i++) {
      const targetDate = addMonthsUtc(currentDayKey, i);
      const y = targetDate.getUTCFullYear();
      const m = targetDate.getUTCMonth();
      let sum = 0;
      let count = 0;
      for (const day of SAMPLE_DAYS) {
        const sampleDate = new Date(Date.UTC(y, m, day));
        const sampleDoy = getUtcDayOfYear(sampleDate);
        const sampleDoyClamped = Math.max(1, Math.min(366, sampleDoy));
        const sampleWeekIndex = getWeekIndexFromDayOfYear(sampleDoyClamped);
        sum += scoreAtWeek(weeksJson, sampleWeekIndex);
        count += 1;
      }
      const monthlyAvgScore = count > 0 ? Math.round(sum / count) : 0;
      months.push({
        monthIndex: m,
        label: MONTH_LABELS[m],
        score: clampScore(monthlyAvgScore),
      });
    }

    // Peak months: labels where score >= 0.9 * peak and score > 0
    const peak = months.length > 0 ? Math.max(...months.map((x) => x.score)) : 0;
    const peakMonths =
      peak > 0 ? months.filter((x) => x.score >= 0.9 * peak && x.score > 0).map((x) => x.label) : [];

    result.push({
      marketZone,
      todayScore,
      months,
      peakMonths,
      ...(debug ? { debug } : {}),
    });
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId') ?? searchParams.get('productTemplateId');
    if (!templateId) {
      return NextResponse.json({ error: 'templateId or productTemplateId is required' }, { status: 400 });
    }

    const userId = session.user.id;

    const company = await prisma.company.findFirst({
      where: { playerId: userId },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const [wallet, warehouses, productTemplate] = await Promise.all([
      prisma.playerWallet.findUnique({
        where: { userId },
        select: { balanceXp: true, balanceDiamond: true },
      }),
      prisma.companyBuilding.findMany({
        where: { companyId: company.id, role: 'WAREHOUSE', marketZone: { not: null } },
        select: {
          marketZone: true,
          country: {
            select: {
              id: true,
              name: true,
              iso2: true,
              priceMultiplier: true,
            },
          },
        },
      }),
      prisma.productTemplate.findUnique({
        where: { id: templateId },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          baseCost: true,
          suggestedSalePrice: true,
          unlockCostXp: true,
          unlockCostDiamond: true,
          productSeason: true,
          productQuality: true,
          productRarity: true,
          shippingProfile: true,
          productImageTemplates: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { url: true, alt: true, slot: true, sortOrder: true },
          },
          seasonScenarioDefinitionId: true,
          seasonScenarioDefinition: {
            select: { id: true, code: true },
          },
        } as any,
      }),
    ]);

    if (!productTemplate) {
      return NextResponse.json({ error: 'Product template not found' }, { status: 404 });
    }

    const inCollection = await prisma.playerProduct.findFirst({
      where: { companyId: company.id, productTemplateId: templateId },
      select: { id: true },
    });

    const warehouseZones = [...new Set(warehouses.map((w) => w.marketZone).filter(Boolean))] as MarketZone[];
    const firstWarehouse = warehouses[0];
    const country = firstWarehouse?.country ?? null;
    const multiplier = toNumber(country?.priceMultiplier) ?? 1;

    const baseCost = toNumber(productTemplate.baseCost) ?? 0;
    const suggestedBase = toNumber(productTemplate.suggestedSalePrice) ?? 0;
    const computedSuggested = Number((suggestedBase * multiplier).toFixed(2));

    const currentDayKey = await getCompanyGameDayKey(company.id);
    const definitionId = (productTemplate as { seasonScenarioDefinitionId?: string | null }).seasonScenarioDefinitionId ?? null;
    const definitionCode = (productTemplate as { seasonScenarioDefinition?: { code: string } | null }).seasonScenarioDefinition?.code ?? null;

    const seasonalityByZone = await buildSeasonalityByZone(
      definitionId,
      definitionCode,
      warehouseZones,
      currentDayKey
    );

    const imageUrls = (productTemplate as unknown as { productImageTemplates: { url: string }[] }).productImageTemplates.map((i) => i.url);

    return NextResponse.json({
      product: {
        id: productTemplate.id,
        code: productTemplate.code,
        name: productTemplate.name,
        description: productTemplate.description,
        productSeason: productTemplate.productSeason,
        unlockCostXp: productTemplate.unlockCostXp ?? 0,
        unlockCostDiamond: productTemplate.unlockCostDiamond ?? 0,
        baseCost,
        suggestedSalePriceBase: suggestedBase,
        imageUrls,
        isInCollection: Boolean(inCollection),
        seasonalityByZone,
      },
      player: {
        balanceXp: wallet?.balanceXp ?? 0,
        balanceDiamond: wallet?.balanceDiamond ?? 0,
      },
      warehouse: {
        country: country
          ? {
              id: country.id,
              name: country.name,
              iso2: country.iso2,
            }
          : null,
        priceMultiplier: multiplier,
      },
      pricing: {
        suggestedSalePriceComputed: computedSuggested,
      },
    });
  } catch (error) {
    console.error('Error in product quick view:', error);
    return NextResponse.json(
      { error: 'Failed to load product quick view' },
      { status: 500 }
    );
  }
}
