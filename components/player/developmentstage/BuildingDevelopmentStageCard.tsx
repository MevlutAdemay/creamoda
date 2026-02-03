'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UpgradeDetailsWizard } from './UpgradeDetailsWizard';
import { cn } from '@/lib/utils';
import type { WarehouseSummary, MetricStageRow } from './types';
import { ChevronRight } from 'lucide-react';

type BuildingDevelopmentStageCardProps = {
  warehouse: WarehouseSummary;
  stockRow: MetricStageRow;
  salesRow: MetricStageRow;
};

type MetricRowProps = {
  row: MetricStageRow;
  metricType: 'STOCK_COUNT' | 'SALES_COUNT';
  onUpgradeDetails: (metricType: 'STOCK_COUNT' | 'SALES_COUNT') => void;
  className?: string;
};

function MetricRow({ row, metricType, onUpgradeDetails, className }: MetricRowProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{row.label}</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-normal tabular-nums">
            L{row.currentLevel}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onUpgradeDetails(metricType)}
          >
            Upgrade
            <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Progress value={row.progress * 100} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {row.currentCount} / {row.maxAllowed}
        </span>
        {row.nextHint && (
          <span className="text-[11px]">{row.nextHint}</span>
        )}
      </div>
    </div>
  );
}

export function BuildingDevelopmentStageCard({
  warehouse,
  stockRow,
  salesRow,
}: BuildingDevelopmentStageCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMetricType, setModalMetricType] = useState<'STOCK_COUNT' | 'SALES_COUNT' | null>(
    null
  );

  const displayName =
    warehouse.role === 'HQ' ? 'HQ' : warehouse.role === 'WAREHOUSE' ? 'Warehouse' : warehouse.role.replace(/_/g, ' ');
  const zoneLabel = warehouse.marketZone
    ? warehouse.marketZone.replace(/_/g, ' ')
    : null;

  const handleUpgradeDetails = (metricType: 'STOCK_COUNT' | 'SALES_COUNT') => {
    setModalMetricType(metricType);
    setModalOpen(true);
  };

  return (
    <>
      <Card className="overflow-hidden border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{displayName}</h3>
            {zoneLabel && (
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                {zoneLabel}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <MetricRow
            row={stockRow}
            metricType="STOCK_COUNT"
            onUpgradeDetails={handleUpgradeDetails}
          />
          <MetricRow
            row={salesRow}
            metricType="SALES_COUNT"
            onUpgradeDetails={handleUpgradeDetails}
          />
        </CardContent>
      </Card>

      <UpgradeDetailsWizard
        open={modalOpen}
        onOpenChange={setModalOpen}
        buildingId={warehouse.id}
        metricType={modalMetricType}
      />
    </>
  );
}
