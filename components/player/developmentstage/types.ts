/**
 * Data shapes for Development Stage components (WAREHOUSE).
 * Fetched from Prisma: CompanyBuilding, BuildingMetricState, MetricLevelConfig.
 */

export type WarehouseSummary = {
  id: string;
  role: string;
  marketZone: string | null;
};

export type MetricStateRow = {
  buildingId: string;
  metricType: 'STOCK_COUNT' | 'SALES_COUNT';
  currentCount: number;
  currentLevel: number;
};

export type LevelConfigRow = {
  buildingRole: string;
  metricType: 'STOCK_COUNT' | 'SALES_COUNT';
  level: number;
  minRequired: number;
  maxAllowed: number;
};

/** Precomputed row for one metric in the card */
export type MetricStageRow = {
  label: string;
  currentCount: number;
  currentLevel: number;
  maxAllowed: number;
  progress: number; // 0..1
  nextHint: string | null; // e.g. "Next: 100 - 500"
};
