// components/ui/ProductCard.tsx

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Tag,
  ScanEye,
  X,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Receipt,
  Gauge,
  Cpu,
  Coins,
  Gem,
  BarChart3,
  ShoppingCartIcon,
  MousePointerClickIcon,
  FileSearch,
} from 'lucide-react';
import ProductImageCarousel from './ProductImageCarousel';
import type { Product } from '../../types';
import { Button } from './button';
import Image from 'next/image';

export type SeasonalityByZoneItem = {
  marketZone: string;
  todayScore: number;
  months: { monthIndex: number; label: string; score: number }[];
  peakMonths: string[];
  debug?: { definitionCode: string; foundCurve: boolean; weekIndex: number; dayOfYear: number };
};

type ProductCardProps = {
  product: Product;
  /** Template id for quick-view/seasonality fetch; do not assume product.id is templateId. */
  templateId?: string;
  /** Company id for add-to-collection; when present, CTA can call collection API. */
  companyId?: string;
  sku?: string;
  series?: string;
  stock?: number;
  price?: number;
  playerXp?: number;
  playerDiamonds?: number;
  /** Wholesale (fast supply) unit price: baseCost * studio.fastSupplyMultiplier. When set, Price section shows Wholesale Price + add-to-cart button. */
  wholesalePrice?: number | null;
  onAddToCart?: (p: Product) => void;
  /** Called after successful add-to-collection (e.g. to refresh wallet). */
  onAddedToCollection?: (balanceXp: number, balanceDiamond: number) => void;
};

type InspectSection = 'MENU' | 'UNLOCK' | 'PRICE' | 'SCORE' | 'TECH';

export default function ProductCard({
  product,
  templateId: templateIdProp,
  companyId,
  playerXp = 0,
  playerDiamonds = 0,
  wholesalePrice: wholesalePriceProp,
  onAddToCart,
  onAddedToCollection,
}: ProductCardProps) {
  const router = useRouter();
  const [isInspectOpen, setIsInspectOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<InspectSection>('MENU');
  const [fetchedSeasonalityByZone, setFetchedSeasonalityByZone] = React.useState<SeasonalityByZoneItem[] | null>(null);
  const [seasonalityLoading, setSeasonalityLoading] = React.useState(false);
  const [zoneIndex, setZoneIndex] = React.useState(0);
  const [adding, setAdding] = React.useState(false);
  const [addedToCollection, setAddedToCollection] = React.useState(false);

  const isInCollection = Boolean((product as any).isInCollection) || addedToCollection;

  // Seasonality: product.seasonalityByZone or fetched; one zone selected via zoneIndex
  const seasonalityByZone = ((product as any).seasonalityByZone as SeasonalityByZoneItem[] | undefined) ?? fetchedSeasonalityByZone ?? undefined;
  const zones = seasonalityByZone ?? [];
  const selectedZone = zones.length > 0 ? zones[Math.min(zoneIndex, zones.length - 1)] : null;
  const todayScore = selectedZone != null ? Math.max(0, Math.min(100, Math.round(selectedZone.todayScore))) : undefined;
  const months = selectedZone?.months ?? [];
  const peakMonths = selectedZone?.peakMonths ?? [];

  // Unlock costs from product
  const unlockCostXp = product.unlockCostXp ?? null;
  const unlockCostDiamond = product.unlockCostDiamond ?? null;

  // Pricing data from product
  const baseCost = (product as any).baseCost as number | null | undefined;
  const suggestedSalePrice = (product as any).suggestedSalePrice as number | null | undefined;
  const wholesalePrice = wholesalePriceProp ?? (product as any).wholesalePrice as number | null | undefined;
  const warehouses = (product as any).warehouses as Array<{
    country: {
      id: string;
      name: string;
      iso2: string;
      priceMultiplier: number;
    } | null;
  }> | undefined;

  const isUnlockKnown = unlockCostXp !== null || unlockCostDiamond !== null;
  const isFreeUnlock = (unlockCostXp ?? 0) <= 0 && (unlockCostDiamond ?? 0) <= 0;

  // Affordability check
  const canAffordUnlock =
    isFreeUnlock ||
    ((unlockCostXp ?? 0) <= playerXp && (unlockCostDiamond ?? 0) <= playerDiamonds);
  
  const affordabilityHint = !isUnlockKnown
    ? null
    : isFreeUnlock
      ? null
      : !canAffordUnlock
        ? (unlockCostXp ?? 0) > playerXp
          ? 'Not enough XP'
          : (unlockCostDiamond ?? 0) > playerDiamonds
            ? 'Not enough Diamonds'
            : null
        : null;

  const priceLabel =
    typeof product.price === 'number'
      ? `€${product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';

  const scoreLabel =
    todayScore !== undefined
      ? todayScore === 0
        ? 'Out of season'
        : `${todayScore >= 70 ? 'Good' : todayScore >= 40 ? 'Okay' : 'Bad'} ${todayScore}`
      : '—';
  const hasMultipleZones = zones.length > 1;

  const templateId = templateIdProp ?? product.id;

  const unlockHint = !isUnlockKnown
    ? '—'
    : isFreeUnlock
      ? 'Free'
      : `${(unlockCostXp ?? 0) > 0 ? `${(unlockCostXp ?? 0).toLocaleString('tr-TR')} XP` : ''}${
          (unlockCostXp ?? 0) > 0 && (unlockCostDiamond ?? 0) > 0 ? ' + ' : ''
        }${(unlockCostDiamond ?? 0) > 0 ? `${(unlockCostDiamond ?? 0).toLocaleString('tr-TR')} ♦` : ''}`;

  const technicalHint = product.code ? 'SKU / Code' : '—';

  // Lazy fetch seasonalityByZone when SCORE tab is selected and we don't have it yet
  React.useEffect(() => {
    if (activeSection !== 'SCORE' || seasonalityByZone != null || !templateId) return;
    let cancelled = false;
    setSeasonalityLoading(true);
    fetch(`/api/player/product-quick-view?templateId=${encodeURIComponent(templateId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load'))))
      .then((payload: { product?: { seasonalityByZone?: SeasonalityByZoneItem[] } }) => {
        if (cancelled) return;
        const byZone = payload?.product?.seasonalityByZone;
        if (Array.isArray(byZone)) {
          setFetchedSeasonalityByZone(byZone);
          setZoneIndex(0);
        }
      })
      .catch(() => { if (!cancelled) setFetchedSeasonalityByZone(null); })
      .finally(() => { if (!cancelled) setSeasonalityLoading(false); });
    return () => { cancelled = true; };
  }, [activeSection, seasonalityByZone, templateId]);

  const openInspect = () => {
    setIsInspectOpen(true);
    setActiveSection('MENU');
  };

  const closeInspect = () => {
    setIsInspectOpen(false);
    setActiveSection('MENU');
  };

  const toggleInspect = () => {
    if (isInspectOpen) closeInspect();
    else openInspect();
  };

  const goBackToMenu = () => setActiveSection('MENU');

  const ctaLabel = isInCollection
    ? 'In Collection'
    : !isUnlockKnown
      ? 'Add to Collection'
      : isFreeUnlock
        ? 'Add to Collection'
        : 'Unlock & Add';

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group w-full"
    >
      <div
        className={[
          'relative overflow-hidden transition-transform duration-300',
          'min-w-[240px] sm:min-w-full md:max-w-[240px] lg:min-w-[240px] xl:min-w-[240px] 2xl:min-w-[240px] lg:max-w-[260px] mb-3',
          'bg-card',
          'text-card-foreground',
          'shadow-lg',
        ].join(' ')}     
      >
        {/* Görsel alanı + overlayler */}
        <div className="relative h-[400px] bg-muted">
          {/* Görsel kartı tamamen dolduruyor */}
          <div className="absolute inset-0">
            <ProductImageCarousel
              images={product.imageUrls || (product.imageUrl ? [product.imageUrl] : [])}
              alt={product.title}
              loop={false}
            />
          </div>

          {/* Inspect overlay panel (card-local, no modal/nav) */}
          <AnimatePresence>
            {isInspectOpen && (
              <motion.div
                key="inspect-panel"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-20 flex flex-col"
                style={{
                  // ensure panel intercepts pointer events (carousel shouldn't drag)
                  pointerEvents: 'auto',
                }}
              >
                {/* Scrim + blur layer (separate from content) */}
                <div className="absolute inset-0 bg-black/25 dark:bg-black/35 backdrop-blur-lg" />
                <div className="relative z-10 flex h-full flex-col border border-white/10 bg-white/10 dark:bg-black/20 backdrop-blur-[2px] text-white/90">
                  {/* Top controls row */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-3">
                    {activeSection !== 'MENU' ? (
                      <button
                        type="button"
                        onClick={goBackToMenu}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Back"
                      >
                        <ChevronLeft className="h-4 w-4 text-white/80" />
                        Back
                      </button>
                    ) : (
                      <div className="h-7" />
                    )}

                    <div className="text-xs font-medium text-white/90">
                      {activeSection === 'MENU'
                        ? 'Inspect'
                        : activeSection === 'UNLOCK'
                          ? 'Unlock'
                          : activeSection === 'PRICE'
                            ? 'Price'
                            : activeSection === 'SCORE'
                              ? 'Score'
                              : 'Technical'}
                    </div>

                    <button
                      type="button"
                      onClick={closeInspect}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/10 dark:hover:bg-black/20 transition-colors"
                      aria-label="Close inspect panel"
                    >
                      <X className="h-4 w-4 text-white/80" />
                    </button>
                  </div>

                  {/* Content screens */}
                  <div className="relative flex-1 overflow-hidden px-3 pb-3 pt-2">
                    <AnimatePresence mode="wait">
                      {activeSection === 'MENU' ? (
                        <motion.div
                          key="menu"
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full"
                        >
                          {/* Frosted plate behind the menu (premium) */}
                          <div className="rounded-xl border border-white/10 bg-black/20 backdrop-blur-xl p-2">
                            <div className="grid grid-cols-2 gap-2">
                              <MenuTile
                                icon={<LockKeyhole className="h-5 w-5 text-white/80" />}
                                label="Unlock"
                                hint={unlockHint || '—'}
                                onClick={() => !isInCollection && setActiveSection('UNLOCK')}
                                disabled={isInCollection}
                              />
                              <MenuTile
                                icon={<Receipt className="h-5 w-5 text-white/80" />}
                                label="Price"
                                hint={priceLabel}
                                onClick={() => setActiveSection('PRICE')}
                              />
                              <MenuTile
                                icon={<Gauge className="h-5 w-5 text-white/80" />}
                                label="Score"
                                hint={scoreLabel}
                                onClick={() => setActiveSection('SCORE')}
                              />
                              <MenuTile
                                icon={<Cpu className="h-5 w-5 text-white/80" />}
                                label="Technical"
                                hint={technicalHint}
                                onClick={() => setActiveSection('TECH')}
                              />
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="detail"
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full overflow-y-auto pr-1"
                        >
                          {activeSection === 'UNLOCK' && (
                            <div className="space-y-4">
                              <div className="text-sm font-semibold text-white/90">Unlock</div>
                              
                              {/* Player Balance Section */}
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-white/80">Player Balance</div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-white/70">XP Balance</span>
                                    <span className="inline-flex items-center gap-1.5 text-white/90 font-medium">
                                      <Coins className="h-3.5 w-3.5 text-yellow-500" />
                                      {playerXp.toLocaleString('tr-TR')}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-white/70">Diamond Balance</span>
                                    <span className="inline-flex items-center gap-1.5 text-white/90 font-medium">
                                      <Gem className="h-3.5 w-3.5 text-cyan-500" />
                                      {playerDiamonds.toLocaleString('tr-TR')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Unlock Cost Section */}
                              <div className="space-y-2 pt-2 border-t border-white/10">
                                <div className="text-xs font-medium text-white/80">Unlock Cost</div>
                                {isUnlockKnown ? (
                                  isFreeUnlock ? (
                                    <div className="text-xs text-white/90">Free</div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {(unlockCostXp ?? 0) > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-white/70">XP</span>
                                          <span className="inline-flex items-center gap-1.5 text-white/90 font-medium">
                                            <Coins className="h-3.5 w-3.5 text-yellow-500" />
                                            {(unlockCostXp ?? 0).toLocaleString('tr-TR')}
                                          </span>
                                        </div>
                                      )}
                                      {(unlockCostDiamond ?? 0) > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-white/70">Diamonds</span>
                                          <span className="inline-flex items-center gap-1.5 text-white/90 font-medium">
                                            <Gem className="h-3.5 w-3.5 text-cyan-500" />
                                            {(unlockCostDiamond ?? 0).toLocaleString('tr-TR')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <div className="text-xs text-white/70">Coming soon</div>
                                )}
                              </div>
                            </div>
                          )}

                          {activeSection === 'PRICE' && (
                            <div className="space-y-4">
                              <div className="text-sm font-semibold text-white/90">Price</div>
                              
                              {/* Production Cost */}
                              <div className="space-y-2 flex flex-row justif-start gap-6">
                                <div className="text-xs font-medium text-white/80">Production Cost</div>
                                <div className="text-xs text-white/90 font-medium">
                                  {baseCost !== null && baseCost !== undefined
                                    ? `€${baseCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : '—'}
                                </div>
                              </div>

                              {/* Wholesale Price (Fast Supply) */}
                              {wholesalePrice != null && typeof wholesalePrice === 'number' && (
                                <div className="space-y-2 flex flex-row justify-between items-center gap-2 pt-2 border-t border-white/10">
                                  <div className="text-xs font-medium text-white/80 align-middle justify-center">
                                  <span className="text-white/70 text-[12px]">Wholesale Price</span><br />
                                  <span className="text-white/70 text-[9px]">Fast Supply</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-white/90 font-medium">
                                      €{wholesalePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    </div>
                                  <div>
                                    {onAddToCart && (
                                      <Button
                                        type="button"
                                        onClick={() => onAddToCart(product)}                                        
                                        aria-label="Add to fast supply cart"
                                        variant="default"
                                        size="icon"
                                        className="rounded-lg cursor-pointer"
                                      >
                                        <ShoppingCartIcon className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Suggested Price by Warehouse */}
                              {warehouses && warehouses.length > 0 && suggestedSalePrice !== null && suggestedSalePrice !== undefined ? (
                                <div className="space-y-2 pt-2 border-t border-white/10">
                                  <div className="text-xs font-medium text-white/80">Suggested SALE Price</div>
                                  <div className="space-y-2">
                                    {warehouses.map((warehouse, idx) => {
                                      if (!warehouse.country) return null;
                                      const multiplier = warehouse.country.priceMultiplier;
                                      const computedPrice = Number((suggestedSalePrice * multiplier).toFixed(2));
                                      
                                      return (
                                        <div key={idx} className="flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-2">
                                            <Image
                                              src={`/flags/${warehouse.country.iso2}.svg`}
                                              alt={warehouse.country.name}
                                              width={16}
                                              height={12}
                                              className="rounded-sm"
                                            />
                                            <span className="text-white/70">{warehouse.country.name}</span>
                                          </div>
                                          <div className="text-white/90 font-medium">
                                            €{computedPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2 pt-2 border-t border-white/10">
                                  <div className="text-xs font-medium text-white/80">Suggested Price</div>
                                  <div className="text-xs text-white/70">No warehouses available</div>
                                </div>
                              )}
                            </div>
                          )}

                          {activeSection === 'SCORE' && (
                            <div className="space-y-2">
                              
                              {seasonalityLoading ? (
                                <div className="text-xs text-white/70">Loading…</div>
                              ) : zones.length === 0 ? (
                                <div className="text-xs text-white/70">Season: Open quick view for details</div>
                              ) : (
                                <>
                                  {hasMultipleZones && (
                                  <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1">
                                    <button
                                      type="button"
                                      onClick={() => setZoneIndex((i) => Math.max(0, i - 1))}
                                      className="rounded p-0.5 text-white/80 hover:text-white hover:bg-white/10"
                                      aria-label="Previous zone"
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="text-[10px] font-medium text-white/80 truncate">{selectedZone?.marketZone ?? '—'}</span>
                                    <button
                                      type="button"
                                      onClick={() => setZoneIndex((i) => Math.min(zones.length - 1, i + 1))}
                                      className="rounded p-0.5 text-white/80 hover:text-white hover:bg-white/10"
                                      aria-label="Next zone"
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </button>
                                  </div>
                                  )}
                                  {!hasMultipleZones && selectedZone && (
                                    <div className="text-[10px] text-white/70">{selectedZone.marketZone}</div>
                                  )}
                                  
                                  {months.length > 0 && (
                                    <>
                                      <div className="text-xs font-medium text-white/80 pt-1 border-t border-white/10">6 months</div>
                                      <div className="flex flex-col gap-1">
                                        {months.map((item, idx) => {
                                          const score = Math.max(0, Math.min(100, Number(item.score)));
                                          return (
                                            <div key={`${item.label}-${idx}`} className="flex items-center gap-2">
                                              <span className="text-white/70 w-7 text-[10px]">{item.label}</span>
                                              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                <div
                                                  className="h-full rounded-full bg-white/60"
                                                  style={{ width: `${score}%` }}
                                                />
                                              </div>
                                              <span className="text-white/70 text-[10px] w-6">{score}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}
                                  {peakMonths.length > 0 && (
                                    <div className="text-xs text-white/70 pt-0.5">
                                      Peak: {peakMonths.join('–')}
                                    </div>
                                  )}
                                  {process.env.NODE_ENV !== 'production' && selectedZone?.debug && (
                                    <div className="text-[10px] text-white/50">
                                      {selectedZone.debug.definitionCode}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {activeSection === 'TECH' && (
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-white/90">Technical</div>
                              <div className="text-xs text-white/80">
                                Code: <span className="text-white/90 font-medium">{product.code || '—'}</span>
                              </div>
                              <div className="text-xs text-white/80">
                                Images: <span className="text-white/90 font-medium">{(product.imageUrls?.length ?? (product.imageUrl ? 1 : 0)).toString()}</span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Sticky CTA footer (always visible while panel open) */}
                  <div className="sticky bottom-0 border-t border-white/10 bg-black/20 backdrop-blur-[2px] px-3 py-3">
                    <div className="space-y-1.5">
                      <Button
                        className="w-full h-10 text-sm"
                        disabled={
                          isInCollection ||
                          adding ||
                          (!isFreeUnlock && !canAffordUnlock) ||
                          (ctaLabel !== 'In Collection' && !companyId && !onAddToCart)
                        }
                        onClick={async () => {
                          if (onAddToCart) {
                            onAddToCart(product);
                            return;
                          }
                          if (isInCollection || !companyId) return;
                          setAdding(true);
                          try {
                            const res = await fetch('/api/player/collection/add', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                companyId,
                                productTemplateId: templateId,
                                idempotencyKey: crypto.randomUUID(),
                              }),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              throw new Error(data?.error ?? 'Add to collection failed');
                            }
                            setAddedToCollection(true);
                            if (typeof data.balanceXp === 'number' && typeof data.balanceDiamond === 'number') {
                              onAddedToCollection?.(data.balanceXp, data.balanceDiamond);
                            }
                            router.refresh();
                          } catch {
                            // Error could be shown via toast; for now just re-enable button
                          } finally {
                            setAdding(false);
                          }
                        }}
                      >
                        {adding ? 'Adding…' : ctaLabel}
                      </Button>
                      {affordabilityHint && (
                        <p className="text-[10px] text-white/70 text-center">
                          {affordabilityHint}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* In Collection / HangTag badge - Top Right */}
          {isInCollection && (
            <div className="absolute top-3 right-3 z-10" title="In Collection">
              <HangTagBadge />
            </div>
          )}

          {/* Üstte sol hizalı ürün adı (transparent arka plan) */}
          <TopBar product={product} />

          {/* Alt açıklama + CTA: sabit glass panel */}
          <div className="absolute inset-x-0 bottom-3">
            <div
              className={[
                'mx-3 mb-3 px-4 py-1',
                // Liquid glass effect
                'bg-white/10 backdrop-blur-md backdrop-saturate-150',
                'before:content-[""] before:absolute before:inset-0 before:bg-linear-to-b before:from-white/20 before:to-transparent before:pointer-events-none',
                'relative',
              ].join(' ')}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(12px) saturate(180%)',
                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
              }}
            >
              <div className="flex items-center justify-between gap-1 relative z-10">
                {product.code ? (
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug line-clamp-2 font-medium">
                    {product.code}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}

                <Button
                  onClick={toggleInspect}
                  variant="outline"
                  size="icon"
                  aria-label={isInspectOpen ? 'Close inspect panel' : 'Inspect product'}
                  className="rounded-lg cursor-pointer"
                >
                  {isInspectOpen ? <X className="w-6 h-6" /> : <FileSearch className="w-6 h-6" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </motion.article>
  );
}

/* ---------------------------------------------------------
   In Collection badge (Lucide Tag icon)
--------------------------------------------------------- */
function HangTagBadge() {
  return (
    <div
      className="flex items-center justify-center w-8 h-8 rounded-full border border-primary bg-primary text-primary-foreground shadow-md"
      title="In Collection"
    >
      <Tag className="w-4 h-4 text-primary-foreground" aria-hidden />
    </div>
  );
}

/* ---------------------------------------------------------
   Üstte sol tarafa transparan title overlay
--------------------------------------------------------- */
function TopBar({ product }: { product: Product }) {
  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 flex justify-start">
      <span
        className={[
          'inline-flex max-w-full items-center',
          'text-xs font-medium text-foreground',
          // Hafif okunurluk için küçük bir gölge, arka plan yine transparan
          'text-gray-500 dark:text-gray-300',
        ].join(' ')}
      >
        <span className="truncate">{product?.name}</span>
      </span>
    </div>
  );
}

function MenuTile({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        'group relative overflow-hidden rounded-lg border border-white/10',
        'bg-black/20',
        'px-3 py-3 text-left',
        'transition-transform duration-150 active:scale-[0.98]',
        disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/16 dark:hover:bg-black/30',
      ].join(' ')}
      aria-label={label}
      aria-disabled={disabled}
    >
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="text-white/80">{icon}</div>
        <div className="text-[11px] text-white/70 mt-1">{hint}</div>
      </div>
      <div className="mt-2 text-sm font-semibold text-white/90">{label}</div>
    </button>
  );
}
