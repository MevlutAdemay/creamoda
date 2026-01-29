// components/ui/ProductQuickViewDialog.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import ProductImageCarousel from '@/components/ui/ProductImageCarousel';
import { Coins, Gem, ChevronLeft, ChevronRight } from 'lucide-react';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import type { SeasonalityByZoneItem } from './ProductCard';

type QuickViewPayload = {
  product: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    productSeason: string;
    unlockCostXp: number;
    unlockCostDiamond: number;
    baseCost: number;
    suggestedSalePriceBase: number;
    imageUrls: string[];
    isInCollection: boolean;
    seasonalityByZone: SeasonalityByZoneItem[];
  };
  player: {
    balanceXp: number;
    balanceDiamond: number;
  };
  warehouse: {
    country: { id: string; name: string; iso2: string } | null;
    priceMultiplier: number;
  };
  pricing: {
    suggestedSalePriceComputed: number;
  };
};

type ProductQuickViewDialogProps = {
  /** Template id for quick-view fetch (standardized). */
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatMoney(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProductQuickViewDialog({ templateId, open, onOpenChange }: ProductQuickViewDialogProps) {
  const [data, setData] = useState<QuickViewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoneIndex, setZoneIndex] = useState(0);

  useEffect(() => {
    if (data?.product?.seasonalityByZone) setZoneIndex(0);
  }, [templateId, data?.product?.seasonalityByZone]);

  // Fetch once per open (and template id change)
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/player/product-quick-view?templateId=${encodeURIComponent(templateId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || 'Failed to load product');
        }
        return res.json() as Promise<QuickViewPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, templateId]);

  const unlock = useMemo(() => {
    const xp = data?.product.unlockCostXp ?? 0;
    const dia = data?.product.unlockCostDiamond ?? 0;
    const isFree = xp <= 0 && dia <= 0;
    const balanceXp = data?.player.balanceXp ?? 0;
    const balanceDiamond = data?.player.balanceDiamond ?? 0;
    const enough = balanceXp >= xp && balanceDiamond >= dia;
    const ctaLabel = data?.product.isInCollection
      ? 'In Collection'
      : isFree
        ? 'Add to Collection'
        : 'Unlock & Add';
    return { xp, dia, isFree, balanceXp, balanceDiamond, enough, ctaLabel };
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="truncate">Product Quick View</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <ModaVerseLogoLoader size={52} className="text-foreground/70" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : !data ? (
          <div className="text-sm text-muted-foreground">No data.</div>
        ) : (
          <div className="space-y-4">
            {/* Top: image + basic info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-[2px] overflow-hidden">
                <div className="relative h-[320px] bg-muted/30">
                  <ProductImageCarousel images={data.product.imageUrls} alt={data.product.name} loop={false} />
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-[2px] p-4 space-y-2">
                <div className="text-sm text-muted-foreground">{data.product.code}</div>
                <div className="text-lg font-semibold leading-tight">{data.product.name}</div>
                {data.product.description && (
                  <div className="text-sm text-muted-foreground line-clamp-4">
                    {data.product.description}
                  </div>
                )}

                <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>XP Balance</span>
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Coins className="h-3.5 w-3.5 text-yellow-500" />
                      {unlock.balanceXp.toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Diamond Balance</span>
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Gem className="h-3.5 w-3.5 text-cyan-500" />
                      {unlock.balanceDiamond.toLocaleString('tr-TR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="unlock" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border border-border/50 rounded-lg p-1 backdrop-blur-[2px]">
                <TabsTrigger
                  value="unlock"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Unlock
                </TabsTrigger>
                <TabsTrigger
                  value="pricing"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Pricing
                </TabsTrigger>
                <TabsTrigger
                  value="season"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Season Score
                </TabsTrigger>
              </TabsList>

              <TabsContent value="unlock" className="pt-3">
                <div className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-[2px] p-4 space-y-3">
                  <div className="text-sm font-medium">Unlock Costs</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground mb-1">XP</div>
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-yellow-500" />
                        <span className="font-semibold">{unlock.xp.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Diamonds</div>
                      <div className="flex items-center gap-2">
                        <Gem className="h-4 w-4 text-cyan-500" />
                        <span className="font-semibold">{unlock.dia.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      className="w-full"
                      disabled={data.product.isInCollection || (!unlock.isFree && !unlock.enough)}
                      title={
                        data.product.isInCollection
                          ? 'Already in your collection'
                          : !unlock.isFree && !unlock.enough
                            ? 'Insufficient balance'
                            : undefined
                      }
                      onClick={() => {
                        // TODO: Implement unlock + add flow (single action) later.
                        // For now, modal provides correct pricing + eligibility UI.
                      }}
                    >
                      {unlock.ctaLabel}
                    </Button>
                    {!unlock.isFree && !unlock.enough && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        You don&apos;t have enough currency to unlock this template.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="pt-3">
                <div className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-[2px] p-4 space-y-3">
                  <div className="text-sm font-medium">Pricing</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Base cost (no multiplier)</div>
                      <div className="font-semibold">{formatMoney(data.product.baseCost)}</div>
                    </div>
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Suggested sale price (computed)</div>
                      <div className="font-semibold">{formatMoney(data.pricing.suggestedSalePriceComputed)}</div>
                    </div>
                  </div>

                  <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm">
                    <div className="text-xs text-muted-foreground mb-1">Warehouse pricing context</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {data.warehouse.country ? data.warehouse.country.name : 'No active warehouse'}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        multiplier x{data.warehouse.priceMultiplier.toFixed(3)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {formatMoney(data.product.suggestedSalePriceBase)} × {data.warehouse.priceMultiplier.toFixed(3)} = {formatMoney(data.pricing.suggestedSalePriceComputed)}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="season" className="pt-3">
                <div className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-[2px] p-4 space-y-3">
                  <div className="text-sm font-medium">Season</div>
                  {data.product.seasonalityByZone.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No season scenario data. Assign a scenario to this template or add warehouses.</div>
                  ) : (
                    (() => {
                      const zones = data.product.seasonalityByZone;
                      const hasMultipleZones = zones.length > 1;
                      const idx = Math.min(zoneIndex, zones.length - 1);
                      const zone = zones[idx];
                      const todayScore = Math.max(0, Math.min(100, Math.round(zone.todayScore)));
                      const months = zone.months ?? [];
                      const peakMonths = zone.peakMonths ?? [];
                      return (
                        <>
                          {hasMultipleZones && (
                            <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 p-2">
                              <button
                                type="button"
                                onClick={() => setZoneIndex((i) => Math.max(0, i - 1))}
                                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                                aria-label="Previous zone"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <span className="text-sm font-medium truncate">{zone.marketZone}</span>
                              <button
                                type="button"
                                onClick={() => setZoneIndex((i) => Math.min(zones.length - 1, i + 1))}
                                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                                aria-label="Next zone"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                          {!hasMultipleZones && <div className="text-xs text-muted-foreground">{zone.marketZone}</div>}
                          <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">
                                {todayScore > 0 ? 'Season fit' : 'Status'}
                              </div>
                              <div className="text-lg font-semibold">
                                {todayScore > 0
                                  ? `${todayScore >= 70 ? 'Good' : todayScore >= 40 ? 'Okay' : 'Bad'} ${todayScore}`
                                  : 'Out of season'}
                              </div>
                            </div>
                            {todayScore === 0 && (
                              <div className="mt-1 text-xs text-muted-foreground">Sales disabled</div>
                            )}
                          </div>
                          {months.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-muted-foreground">6 months</div>
                              <div className="flex flex-col gap-1.5">
                                {months.map((item, i) => {
                                  const score = Math.max(0, Math.min(100, Number(item.score)));
                                  return (
                                    <div key={`${item.label}-${i}`} className="flex items-center gap-2">
                                      <span className="text-muted-foreground w-8 text-xs">{item.label}</span>
                                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-primary/70"
                                          style={{ width: `${score}%` }}
                                        />
                                      </div>
                                      <span className="text-muted-foreground text-xs w-6">{score}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                          {peakMonths.length > 0 && (
                            <div className="text-xs text-muted-foreground pt-0.5">
                              Peak: {peakMonths.join('–')}
                            </div>
                          )}
                          {process.env.NODE_ENV !== 'production' && zone.debug && (
                            <div className="text-[10px] text-muted-foreground">
                              {zone.debug.definitionCode} · curve={String(zone.debug.foundCurve)} · w{zone.debug.weekIndex}
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

