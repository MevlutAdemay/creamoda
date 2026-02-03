/**
 * Season score for demand (Step A).
 * Resolves MarketZoneSeasonScenario by (definitionId, marketZone), reads weeksJson (52 ints, index 0 = week 1).
 * If no definitionId or no row, returns score 100 and missingScenario true (for debug).
 */

import type { MarketZone } from '@prisma/client';

type Tx = Parameters<Parameters<typeof import('@/lib/prisma').default.$transaction>[0]>[0];

/**
 * 0-based week index 0..51 from UTC dayKey (week 1 = index 0).
 * Uses simple day-of-year / 7, clamped to 0..51.
 */
export function getWeekIndex0FromDayKey(dayKey: Date): number {
  const startOfYear = new Date(Date.UTC(dayKey.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const msPerDay = 86400000;
  const dayOfYear = Math.floor((dayKey.getTime() - startOfYear.getTime()) / msPerDay);
  return Math.min(51, Math.max(0, Math.floor(dayOfYear / 7)));
}

export interface SeasonScoreResult {
  score: number;
  missingScenario: boolean;
}

/**
 * Resolve season score for (marketZone, definitionId, dayKey).
 * If no definitionId or no MarketZoneSeasonScenario row, returns { score: 100, missingScenario: true }.
 */
export async function getSeasonScore(
  marketZone: MarketZone,
  definitionId: string | null,
  dayKey: Date,
  tx: Tx
): Promise<SeasonScoreResult> {
  if (!definitionId) {
    return { score: 100, missingScenario: true };
  }
  const scenario = await tx.marketZoneSeasonScenario.findUnique({
    where: {
      definitionId_marketZone: { definitionId, marketZone },
      isActive: true,
    },
    select: { weeksJson: true },
  });
  if (!scenario?.weeksJson) {
    return { score: 100, missingScenario: true };
  }
  const weeks = scenario.weeksJson as number[];
  const weekIndex = getWeekIndex0FromDayKey(dayKey);
  const score = Number(weeks[weekIndex] ?? 100);
  return { score: Math.min(100, Math.max(0, score)), missingScenario: false };
}
