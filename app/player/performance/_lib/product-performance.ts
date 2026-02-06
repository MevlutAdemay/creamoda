/**
 * Product Performance – band-config-based scoring and list/detail types.
 * Label and notes derived from product_sales_band_configs (minDaily, maxDaily, expectedMode).
 */

export type PerformanceLabel = 'Poor' | 'Average' | 'Good' | 'Excellent';

export type PerformanceSortKey =
  | 'performance'
  | 'name'
  | 'avgDailySales'
  | 'profitability'
  | 'stockRisk'
  | 'seasonFit'
  | 'expectedSoldSeason'
  | 'expectedLeftoverSeason';

export type PerformanceSortDir = 'asc' | 'desc';

/** Sales band evaluation (Weak/Bad/Good/Very good/Super + note), same as detail. */
export type SalesBandEvaluation = {
  pct: number;
  label: string;
  note: string;
  tone: 'danger' | 'warning' | 'neutral' | 'success';
};

/** List row shape (shared by server data and client list); _* fields used for client-side sort only */
export type PerformanceListRow = {
  playerProductId: string;
  productName: string;
  productImageUrl: string | null;
  productImageAlt: string | null;
  label: PerformanceLabel;
  /** Band-based sales evaluation for list display (label + pct + note) */
  salesBandEvaluation: SalesBandEvaluation;
  _score: number;
  _avgDailySales: number;
  _profitMargin: number;
  _stockDaysRemaining: number | null;
  _seasonScore: number;
  listingId: string;
  marketZone: string;
  /** Until season end (weeksJson + baseQty); null when no curve. */
  expectedSoldSeason: number | null;
  expectedLeftoverSeason: number | null;
};

/** Band config row used for scoring (from ProductSalesBandConfig). */
export type BandConfigForScore = {
  minDaily: number;
  maxDaily: number;
  expectedMode: number | null;
};

export interface BandBasedScoreResult {
  label: PerformanceLabel;
  /** One-line rule-based note for Overview card and list comment */
  performanceNotes: string;
  /** 0–100 for list sort only */
  score: number;
}

/**
 * Compute label from actual vs band expectations (no fixed weights).
 * Rules:
 * - actualAvgDaily <= 0 -> Poor
 * - actualAvgDaily < minDaily*0.6 -> Poor
 * - actualAvgDaily < expectedMode*0.9 -> Average (expectedMode fallback: (minDaily+maxDaily)/2)
 * - actualAvgDaily <= maxDaily*1.1 -> Good
 * - else -> Excellent
 */
export function computePerformanceScoreFromBand(
  actualAvgDaily: number,
  band: BandConfigForScore | null,
  stockOnHand: number,
  stockDaysRemaining: number | null
): BandBasedScoreResult {
  const effectiveExpected = band?.expectedMode ?? (band ? (band.minDaily + band.maxDaily) / 2 : 2);
  const minDaily = band?.minDaily ?? 0;
  const maxDaily = band?.maxDaily ?? 10;

  let label: PerformanceLabel;
  if (actualAvgDaily <= 0) {
    label = 'Poor';
  } else if (!band) {
    label = actualAvgDaily < 2 ? 'Poor' : actualAvgDaily < 5 ? 'Average' : 'Good';
  } else if (actualAvgDaily < minDaily * 0.6) {
    label = 'Poor';
  } else if (actualAvgDaily < effectiveExpected * 0.9) {
    label = 'Average';
  } else if (actualAvgDaily <= maxDaily * 1.1) {
    label = 'Good';
  } else {
    label = 'Excellent';
  }

  const performanceNotes = buildPerformanceNotes(
    actualAvgDaily,
    band,
    effectiveExpected,
    stockDaysRemaining
  );

  const score =
    label === 'Poor' ? 20 : label === 'Average' ? 45 : label === 'Good' ? 70 : 95;

  return { label, performanceNotes, score };
}

function buildPerformanceNotes(
  actualAvgDaily: number,
  band: BandConfigForScore | null,
  expectedMode: number,
  stockDaysRemaining: number | null
): string {
  const parts: string[] = [];
  if (band) {
    if (actualAvgDaily < expectedMode * 0.9) parts.push('Below expected band');
    else if (actualAvgDaily <= (band.maxDaily ?? expectedMode) * 1.1) parts.push('On target');
    else parts.push('Above target');
  } else {
    parts.push(actualAvgDaily <= 0 ? 'No sales' : 'Band not configured');
  }
  if (stockDaysRemaining != null) {
    if (stockDaysRemaining < 14) parts.push('Low stock risk');
    else if (stockDaysRemaining > 180) parts.push('Overstock risk');
  }
  return parts.join(' · ');
}

/** Legacy weight-based scoring (kept for any external use). Prefer computePerformanceScoreFromBand. */
export interface PerformanceScoreInputs {
  avgDailySales: number;
  profitMargin: number;
  seasonScore: number;
  stockOnHand: number;
  stockDaysRemaining: number | null;
}

export interface PerformanceResult {
  label: PerformanceLabel;
  comment: string;
  score: number;
  avgDailySales: number;
  profitMargin: number;
  seasonScore: number;
  stockDaysRemaining: number | null;
}

const COMMENT_POOL: Record<PerformanceLabel, string[]> = {
  Poor: ['Selling but low margin', 'Season mismatch', 'Stock risk', 'Low demand'],
  Average: ['Stable but room to improve', 'Price could be optimized', 'Moderate demand'],
  Good: ['Growing demand', 'Strong in season', 'Solid performer'],
  Excellent: ['Top performer', 'High margin, strong sales', 'Peak season star'],
};

function pickComment(label: PerformanceLabel, seed: number): string {
  const pool = COMMENT_POOL[label];
  return pool[Math.abs(seed) % pool.length];
}

export function computePerformanceScore(inputs: PerformanceScoreInputs): PerformanceResult {
  const result = computePerformanceScoreFromBand(
    inputs.avgDailySales,
    null,
    inputs.stockOnHand,
    inputs.stockDaysRemaining
  );
  return {
    label: result.label,
    comment: pickComment(result.label, (inputs.avgDailySales * 7 + inputs.seasonScore) | 0),
    score: result.score,
    avgDailySales: inputs.avgDailySales,
    profitMargin: inputs.profitMargin,
    seasonScore: inputs.seasonScore,
    stockDaysRemaining: inputs.stockDaysRemaining,
  };
}

const LABEL_ORDER: PerformanceLabel[] = ['Poor', 'Average', 'Good', 'Excellent'];

export function getLabelOrderForSort(): PerformanceLabel[] {
  return [...LABEL_ORDER];
}

/** Sort key for "default: Poor → Excellent" */
export const PERFORMANCE_LABEL_SORT_ORDER: Record<PerformanceLabel, number> = {
  Poor: 0,
  Average: 1,
  Good: 2,
  Excellent: 3,
};

function cmpNum(a: number, b: number, dir: PerformanceSortDir): number {
  return dir === 'asc' ? a - b : b - a;
}
function cmpStr(a: string, b: string, dir: PerformanceSortDir): number {
  const v = a.localeCompare(b);
  return dir === 'asc' ? v : -v;
}

export function sortPerformanceRows(
  rows: PerformanceListRow[],
  sortKey: PerformanceSortKey,
  sortDir: PerformanceSortDir = 'desc'
): PerformanceListRow[] {
  const copy = [...rows];
  switch (sortKey) {
    case 'performance':
      copy.sort(
        (a, b) =>
          PERFORMANCE_LABEL_SORT_ORDER[a.label] - PERFORMANCE_LABEL_SORT_ORDER[b.label] ||
          cmpNum(a._score, b._score, sortDir)
      );
      break;
    case 'name':
      copy.sort((a, b) => cmpStr(a.productName, b.productName, sortDir));
      break;
    case 'avgDailySales':
      copy.sort((a, b) => cmpNum(a._avgDailySales, b._avgDailySales, sortDir));
      break;
    case 'profitability':
      copy.sort((a, b) => cmpNum(a._profitMargin, b._profitMargin, sortDir));
      break;
    case 'stockRisk':
      copy.sort((a, b) => {
        const da = a._stockDaysRemaining ?? 1e6;
        const db = b._stockDaysRemaining ?? 1e6;
        return cmpNum(da, db, sortDir);
      });
      break;
    case 'seasonFit':
      copy.sort((a, b) => cmpNum(a._seasonScore, b._seasonScore, sortDir));
      break;
    case 'expectedSoldSeason':
      copy.sort((a, b) =>
        cmpNum(a.expectedSoldSeason ?? -1, b.expectedSoldSeason ?? -1, sortDir)
      );
      break;
    case 'expectedLeftoverSeason':
      copy.sort((a, b) =>
        cmpNum(a.expectedLeftoverSeason ?? -1, b.expectedLeftoverSeason ?? -1, sortDir)
      );
      break;
    default:
      copy.sort(
        (a, b) =>
          PERFORMANCE_LABEL_SORT_ORDER[a.label] - PERFORMANCE_LABEL_SORT_ORDER[b.label] ||
          cmpNum(a._score, b._score, sortDir)
      );
  }
  return copy;
}
