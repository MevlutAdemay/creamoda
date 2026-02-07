'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PerformanceDetailData } from '../_lib/detail-data';
import Link from 'next/link';
import {
  Megaphone,
  DollarSign,
  TrendingUp,
  Package,
  BarChart3,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceDialog } from '@/app/player/sales/_components/PriceDialog';
import { useToast } from '@/components/ui/ToastCenter';
import { StartProductCampaignModal } from './StartProductCampaignModal';

const LABEL_VARIANTS: Record<string, 'destructive' | 'secondary' | 'default' | 'outline'> = {
  Poor: 'destructive',
  Average: 'secondary',
  Good: 'default',
  Excellent: 'outline',
};

const FORECAST_PEAK_MONTH_LABELS = ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'];

type PerformanceDetailClientProps = {
  data: PerformanceDetailData;
  backHref: string;
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatUsdPrice(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function trendIcon(diff: number | null) {
  if (diff == null) return null;
  if (diff > 0) return <span className="text-emerald-600">↑</span>;
  if (diff < 0) return <span className="text-amber-600">↓</span>;
  return <span className="text-muted-foreground">→</span>;
}

export function PerformanceDetailClient({
  data,
  backHref,
}: PerformanceDetailClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState(data.warehouseId);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [updatePriceSaving, setUpdatePriceSaving] = useState(false);

  const handleWarehouseChange = (id: string) => {
    setWarehouseId(id);
    router.push(
      `/player/performance/${data.playerProductId}?warehouseId=${encodeURIComponent(id)}`
    );
  };

  const handleStartCampaign = () => {
    setCampaignModalOpen(true);
  };

  const handleAdjustPrice = () => {
    if (!data.inventoryItemId) {
      toast({ kind: 'error', message: 'Cannot update price: inventory item not found for this warehouse.' });
      return;
    }
    setPriceDialogOpen(true);
  };

  const handlePriceDialogConfirm = async (salePrice: number) => {
    if (!data.inventoryItemId) return;
    setUpdatePriceSaving(true);
    try {
      const res = await fetch('/api/player/showcase-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseBuildingId: data.warehouseId,
          inventoryItemId: data.inventoryItemId,
          salePrice,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        toast({ kind: 'error', message: resData.error ?? 'Failed to update price' });
        return;
      }
      toast({ kind: 'success', message: 'Price updated' });
      setPriceDialogOpen(false);
      router.refresh();
    } catch (e) {
      toast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to update price' });
    } finally {
      setUpdatePriceSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" asChild>
        <Link href={backHref} className="inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>
      {/* Header + Action bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="relative w-20 h-28 rounded overflow-hidden bg-muted shrink-0">
            {data.productImageUrl ? (
              <Image
                src={data.productImageUrl}
                alt={data.productImageAlt ?? data.productName}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                —
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{data.productName}</h1>
            
            <div className="mt-2">
              <Select value={warehouseId} onValueChange={handleWarehouseChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="default"
            size="default"
            onClick={handleStartCampaign}
            className="rounded-md"
          >
            <Megaphone className="h-4 w-4" />
            Start Campaign
          </Button>
          <Button
            variant="default"
            size="default"
            onClick={handleAdjustPrice}
            disabled={!data.inventoryItemId}
            className="rounded-md"
          >
            <DollarSign className="h-4 w-4" />
            Adjust Price
          </Button>
        </div>
      </div>

      {/* Left: Overview + Marketing Impact (stacked). Right: Forecast */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {/* Overview – only 4 fields */}
          <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex flex-col items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Stock count</p>
              <p className="text-lg font-semibold">{data.stockCount} units</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sale price</p>
              <p className="text-lg font-semibold">{formatUsdPrice(data.salePriceDisplay)}</p>
              <p
                className={`mt-2 rounded-md px-2 py-1.5 text-sm font-medium ${
                  data.priceEvaluation.tone === 'danger'
                    ? 'price-eval-danger'
                    : data.priceEvaluation.tone === 'warning'
                      ? 'price-eval-warning'
                      : 'price-eval-success'
                }`}
              >
                {data.priceEvaluation.label}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg daily sales</p>
              <p className="text-lg font-semibold">{data.avgDailySales30.toFixed(1)} units</p>
              <p
                className={`mt-2 rounded-md px-2 py-1.5 text-sm font-medium ${
                  data.salesBandEvaluation.tone === 'danger'
                    ? 'sales-eval-danger'
                    : data.salesBandEvaluation.tone === 'warning'
                      ? 'sales-eval-warning'
                      : data.salesBandEvaluation.tone === 'success'
                        ? 'sales-eval-success'
                        : 'sales-eval-neutral'
                }`}
              >
                {data.salesBandEvaluation.label}: %{data.salesBandEvaluation.pct} — {data.salesBandEvaluation.note}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Performance notes</p>
              <p className="text-sm font-medium">{data.performanceNotes}</p>
            </div>
          </CardContent>
        </Card>

          {/* Marketing Impact */}
          <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Marketing Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Active campaigns</p>
              <p className="text-lg font-semibold">
                {data.activeCampaignsCount === 0
                  ? 'No active campaign'
                  : `${data.activeCampaignsCount} campaign${data.activeCampaignsCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            {data.activeCampaignsCount > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Campaign spend (snapshot)</p>
                <p className="text-lg font-semibold">
                  {formatUsd(data.last7dSpendOrTotalSnapshot)}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">{data.marketingNote}</p>
          </CardContent>
        </Card>
        </div>

        {/* Forecast (includes stock) – right column */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-row items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Next 6 months outlook</p>
              <p className="text-lg font-semibold">{data.forecastOutlook}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peak month</p>
              <p className="text-lg font-semibold">
                {FORECAST_PEAK_MONTH_LABELS[data.forecastPeakMonthIndex]} (score {data.forecastPeakMonthScore})
              </p>
            </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stock days left</p>
              <p className="text-lg font-semibold">{Math.round(data.stockDaysLeft)} days</p>
            </div>
            {data.seasonRemaining != null ? (
              <>
                {data.seasonRemaining.outOfSeason ? (
                  <p className="text-sm text-muted-foreground">Out of season.</p>
                ) : (
                  <>
                    {/* 6-bar chart: potentialUnits per month */}
                    {data.seasonRemaining.forecastMonths.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Monthly potential (until season end)</p>
                        <div className="flex items-end gap-1">
                          {data.seasonRemaining.forecastMonths.map((mo, i) => {
                            const maxPot = Math.max(
                              1,
                              ...data.seasonRemaining!.forecastMonths.map((m) => m.potentialUnits)
                            );
                            const hPct = maxPot > 0 ? (mo.potentialUnits / maxPot) * 100 : 0;
                            const isStockout = data.seasonRemaining!.stockoutMonthIndex === i;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center min-w-0">
                                {isStockout && (
                                  <Badge variant="destructive" className="text-[10px] px-1 mb-0.5">
                                    Stockout
                                  </Badge>
                                )}
                                <div className="w-full h-12 flex flex-col justify-end" title={`${mo.label}: ~${Math.round(mo.potentialUnits)} units`}>
                                  <div
                                    className="w-full bg-primary/70 rounded-t transition-all min-h-[2px]"
                                    style={{ height: `${Math.max(2, hPct)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-1">
                                  {mo.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Total potential until season end</span>
                        {' '}
                        <span className="font-semibold">~{Math.round(data.seasonRemaining.potentialUnits)} units</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Expected sold</span>
                        {' '}
                        <span className="font-semibold">~{Math.round(data.seasonRemaining.expectedSold)}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Expected leftover</span>
                        {' '}
                        <span className="font-semibold">~{Math.round(data.seasonRemaining.expectedRemaining)} units</span>
                      </p>
                    </div>
                    <p className="text-sm text-primary">
                      {data.seasonRemaining.noDemandEstimate
                        ? 'Demand forecast not available'
                        : [
                            data.seasonRemaining.expectedRemaining > 0 &&
                              'Invest Marketing for higher sales.',
                            data.seasonRemaining.stockoutMonthIndex != null &&
                              data.seasonRemaining.forecastMonths
                                .slice(data.seasonRemaining.stockoutMonthIndex + 1)
                                .some((m) => m.potentialUnits > 0) &&
                              'Stock will run out before the season ends. Consider RepeatOrder.',
                          ]
                            .filter(Boolean)
                            .join(' ') || null}
                    </p>    
                  </> 
                )}  
              </> 
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly potential</p>
                  <p className="text-lg font-semibold">—</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total potential until season end</p>
                  <p className="text-lg font-semibold">—</p>
                </div>
              </>
            )}
            <p className="text-sm text-muted-foreground">{data.willStockEndBeforePeakNote}</p>
          </CardContent>
        </Card>
      </div>

      <StartProductCampaignModal
        open={campaignModalOpen}
        onOpenChange={setCampaignModalOpen}
        warehouseId={data.warehouseId}
        listingId={data.listingId}
        productName={data.productName}
        warehouseLabel={data.warehouseLabel}
        currentDayKey={data.currentDayKey}
        onSuccess={() => router.refresh()}
      />

      <PriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        mode="update"
        productName={data.productName}
        initialSalePrice={String(data.salePriceDisplay)}
        saving={updatePriceSaving}
        onConfirm={handlePriceDialogConfirm}
      />
    </div>
  );
}
