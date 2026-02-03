'use client';

import { BuildingDevelopmentStageCard } from './BuildingDevelopmentStageCard';
import type {
  WarehouseSummary,
  MetricStateRow,
  LevelConfigRow,
  MetricStageRow,
} from './types';

const BUILDING_ROLE_WAREHOUSE = 'WAREHOUSE';

function getConfig(
  levelConfigs: LevelConfigRow[],
  metricType: 'STOCK_COUNT' | 'SALES_COUNT',
  level: number
): LevelConfigRow | undefined {
  return levelConfigs.find(
    (c) =>
      c.buildingRole === BUILDING_ROLE_WAREHOUSE &&
      c.metricType === metricType &&
      c.level === level
  );
}

function buildMetricRow(
  metricType: 'STOCK_COUNT' | 'SALES_COUNT',
  state: MetricStateRow | undefined,
  levelConfigs: LevelConfigRow[]
): MetricStageRow {
  const label =
    metricType === 'STOCK_COUNT' ? 'Stock Capacity' : 'Daily Sales Capacity';
  const currentCount = state?.currentCount ?? 0;
  const currentLevel = state?.currentLevel ?? 1;
  const levelConfig = getConfig(levelConfigs, metricType, currentLevel);
  const maxAllowed = levelConfig?.maxAllowed ?? Math.max(currentCount, 1);
  const progress = Math.min(1, Math.max(0, currentCount / maxAllowed));
  const nextConfig = getConfig(levelConfigs, metricType, currentLevel + 1);
  const nextHint = nextConfig
    ? `Next: ${nextConfig.minRequired} - ${nextConfig.maxAllowed}`
    : null;
  return {
    label,
    currentCount,
    currentLevel,
    maxAllowed,
    progress,
    nextHint,
  };
}

type BuildingDevelopmentStageListProps = {
  warehouses: WarehouseSummary[];
  metricStates: MetricStateRow[];
  levelConfigs: LevelConfigRow[];
};

export function BuildingDevelopmentStageList({
  warehouses,
  metricStates,
  levelConfigs,
}: BuildingDevelopmentStageListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {warehouses.map((warehouse) => {
        const stockState = metricStates.find(
          (s) =>
            s.buildingId === warehouse.id && s.metricType === 'STOCK_COUNT'
        );
        const salesState = metricStates.find(
          (s) =>
            s.buildingId === warehouse.id && s.metricType === 'SALES_COUNT'
        );
        const stockRow = buildMetricRow('STOCK_COUNT', stockState, levelConfigs);
        const salesRow = buildMetricRow('SALES_COUNT', salesState, levelConfigs);
        return (
          <BuildingDevelopmentStageCard
            key={warehouse.id}
            warehouse={warehouse}
            stockRow={stockRow}
            salesRow={salesRow}
          />
        );
      })}
    </div>
  );
}
