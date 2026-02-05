'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tag, Trash2, Lock, Gem, Sparkles, Store, ShoppingBag, Shirt } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useToast } from '@/components/ui/ToastCenter';
import { ShowcaseImageCarousel, type ShowcaseImageItem } from './ShowcaseImageCarousel';

export type CampaignBadgeItem = {
  type: 'warehouse' | 'category' | 'product';
  title?: string | null;
  packageKeySnapshot?: string | null;
  positiveBoostPct: number;
  negativeBoostPct?: number | null;
  startDayKey: string;
  endDayKey: string;
};

export type ShowcaseCardListing = {
  id: string;
  productName: string;
  productCode?: string;
  salePrice: string;
  listPrice?: string | null;
  suggestedSalePrice?: string | null;
  marketZone: string;
  warehouseBuildingId?: string;
  categoryNodeId?: string | null;
  status: string;
  inventoryItemId?: string | null;
  positiveBoostPct?: number;
  stockQty?: number | null;
  images?: ShowcaseImageItem[];
  activeBadges?: CampaignBadgeItem[];
};

export type ShowcaseCardInventory = {
  inventoryItemId: string;
  productName: string;
  productCode?: string;
  qtyOnHand: number;
  suggestedSalePrice?: string | null;
  avgUnitCost: string;
  playerProductId: string | null;
  images?: ShowcaseImageItem[];
};

type ProductShowcaseCardProps =
  | {
      variant: 'showcase';
      item: ShowcaseCardListing;
      onUpdatePrice: () => void;
      onRemove: () => void;
      updateDisabled?: boolean;
      onUnlockSuccess?: () => void;
    }
  | {
      variant: 'inventory';
      item: ShowcaseCardInventory;
      onList: () => void;
      listingInFlight?: boolean;
    };

function PlaceholderImage({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-full h-full bg-muted/50 flex items-center justify-center',
        className
      )}
    >
      <Tag className="size-10 text-muted-foreground/50" />
    </div>
  );
}

const UNLOCK_BOOST_PCT = 10;

export function ProductShowcaseCard(props: ProductShowcaseCardProps) {
  const { variant } = props;
  const item = props.item;
  const toast = useToast();

  const [unlockSheetOpen, setUnlockSheetOpen] = useState(false);
  const [payWithByImageId, setPayWithByImageId] = useState<Record<string, 'XP' | 'DIAMOND'>>({});
  const [unlockingImageId, setUnlockingImageId] = useState<string | null>(null);

  const name = item.productName ?? '—';
  const code = item.productCode;

  const showcaseItem = variant === 'showcase' ? (item as ShowcaseCardListing) : null;
  const inventoryItem = variant === 'inventory' ? (item as ShowcaseCardInventory) : null;
  const carouselImages =
    variant === 'showcase' ? showcaseItem?.images : inventoryItem?.images;
  const hasCarousel = Boolean(carouselImages && carouselImages.length > 0);
  const lockedImages = (showcaseItem?.images ?? []).filter((i) => !i.isUnlocked);
  const lockedCount = lockedImages.length;

  useEffect(() => {
    if (unlockSheetOpen && lockedImages.length === 0) closeUnlockSheet();
  }, [unlockSheetOpen, lockedImages.length]);

  const openUnlockSheet = () => {
    if (lockedImages.length === 0) return;
    const initial: Record<string, 'XP' | 'DIAMOND'> = {};
    lockedImages.forEach((img) => {
      const costXp = img.effectiveCostXp ?? img.paidXp;
      const costDiamond = img.effectiveCostDiamond ?? img.paidDiamond;
      const hasXp = costXp != null && costXp >= 0;
      const hasDiamond = costDiamond != null && costDiamond >= 0;
      if (img.unlockType === 'PURCHASE_XP' || (hasXp && !hasDiamond)) initial[img.id] = 'XP';
      else if (img.unlockType === 'PURCHASE_DIAMOND' || (!hasXp && hasDiamond)) initial[img.id] = 'DIAMOND';
      else if (hasXp) initial[img.id] = 'XP';
      else if (hasDiamond) initial[img.id] = 'DIAMOND';
    });
    setPayWithByImageId(initial);
    setUnlockSheetOpen(true);
  };

  const closeUnlockSheet = () => {
    setUnlockSheetOpen(false);
    setPayWithByImageId({});
    setUnlockingImageId(null);
  };

  const handleUnlock = async (image: ShowcaseImageItem, payWith: 'XP' | 'DIAMOND') => {
    const cost =
      payWith === 'XP'
        ? image.effectiveCostXp ?? image.paidXp
        : image.effectiveCostDiamond ?? image.paidDiamond;
    if (cost == null || cost < 0) {
      toast({ kind: 'error', message: 'Unlock cost not configured' });
      return;
    }
    setUnlockingImageId(image.id);
    try {
      const res = await fetch(`/api/player/player-product-images/${image.id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payWith }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ kind: 'error', message: data.error ?? 'Failed to unlock' });
        return;
      }
      toast({ kind: 'success', message: `Image unlocked. +${UNLOCK_BOOST_PCT}% boost applied.` });
      setPayWithByImageId((prev) => {
        const next = { ...prev };
        delete next[image.id];
        return next;
      });
      props.variant === 'showcase' && props.onUnlockSuccess?.();
    } catch {
      toast({ kind: 'error', message: 'Failed to unlock' });
    } finally {
      setUnlockingImageId(null);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md hover:shadow-lg transition-shadow',
        'min-h-[256px]'
      )}
    >
      {/* Image area: carousel for showcase/inventory with images, else placeholder */}
      <div className="relative aspect-2/3 w-full  overflow-hidden bg-muted/30">
        {hasCarousel ? (
          <ShowcaseImageCarousel images={carouselImages!} alt={name} />
        ) : (
          <PlaceholderImage className="absolute inset-0" />
        )}
        {/* Top-left micro badge */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
            {'marketZone' in item ? item.marketZone : 'INVENTORY'}
          </Badge>
          {variant === 'showcase' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
              LISTED
            </Badge>
          )}
        </div>
        {/* Stock badge: top-right on Showcase cards */}
        {variant === 'showcase' && 'stockQty' in item && item.stockQty != null && (
          <div className="absolute right-2 top-2">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium tabular-nums">
              Stock {item.stockQty}
            </Badge>
          </div>
        )}
      </div>

      {/* Bottom panel: semi-opaque, clear typography */}
      <div className="relative flex flex-1 flex-col justify-between border-t border-border/50 bg-background/80 backdrop-blur-sm p-3">
        <div className="min-h-0 flex flex-row items-center justify-between">
          <div className='flex flex-col'>
              
          <p className="truncate text-sm font-medium text-foreground" title={name}>
            {name}
          </p>
          {code && (
            <p className="truncate text-xs text-muted-foreground" title={code}>
              {code}
            </p>
          )}
          </div>

          {variant === 'showcase' && (
            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums">
                {typeof (item as ShowcaseCardListing).salePrice === 'string'
                  ? (item as ShowcaseCardListing).salePrice
                  : Number((item as ShowcaseCardListing).salePrice).toFixed(2)}
              </span>
              {(item as ShowcaseCardListing).listPrice != null &&
                parseFloat(String((item as ShowcaseCardListing).listPrice)) > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground line-through tabular-nums">
                      {(item as ShowcaseCardListing).listPrice}
                    </span>
                    {(() => {
                      const sale = parseFloat((item as ShowcaseCardListing).salePrice);
                      const list = parseFloat(String((item as ShowcaseCardListing).listPrice));
                      if (list > 0 && sale < list) {
                        const pct = Math.round((1 - sale / list) * 100);
                        return (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            -{pct}%
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}
            </div>
          )}

          {variant === 'inventory' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Stock: {(item as ShowcaseCardInventory).qtyOnHand}
              </Badge>
              
              {!(item as ShowcaseCardInventory).playerProductId && (
                <span className="text-xs text-amber-600">Cannot list — no player product</span>
              )}
            </div>
          )}
        </div>

        {/* Marketing campaign badges (showcase only) — always 3 slots: Product, Category, Warehouse; active = bg-primary, inactive = bg-background */}
        {variant === 'showcase' && (() => {
          const badges = (item as ShowcaseCardListing).activeBadges ?? [];
          const byType = {
            product: badges.find((b) => b.type === 'product'),
            category: badges.find((b) => b.type === 'category'),
            warehouse: badges.find((b) => b.type === 'warehouse'),
          };
          const slots: { type: 'product' | 'category' | 'warehouse'; badge?: CampaignBadgeItem }[] = [
            { type: 'product', badge: byType.product },
            { type: 'category', badge: byType.category },
            { type: 'warehouse', badge: byType.warehouse },
          ];
          return (
            <div className="mt-2 flex min-h-8 items-center gap-1.5">
              {slots.map(({ type, badge }) => {
                const Icon = type === 'warehouse' ? Store : type === 'category' ? ShoppingBag : Shirt;
                const typeLabel = type === 'warehouse' ? 'Warehouse' : type === 'category' ? 'Category' : 'Product';
                const isActive = !!badge;
                return (
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 cursor-default items-center justify-center rounded-md border transition-colors',
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground'
                        )}
                        aria-label={typeLabel}
                      >
                        <Icon className="size-4" />
                        
                    </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      {badge ? (
                        <>
                          <p className="font-medium">{badge.title ?? badge.packageKeySnapshot ?? 'Campaign'}</p>
                          <p className="text-xs text-muted-foreground">{typeLabel} campaign</p>
                          <p className="text-xs">
                            Boost: {badge.negativeBoostPct != null
                              ? `+${badge.positiveBoostPct}% / -${badge.negativeBoostPct}%`
                              : `+${badge.positiveBoostPct}%`}
                          </p>
                          <p className="text-xs text-muted-foreground">{badge.startDayKey} – {badge.endDayKey}</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No active {typeLabel} campaign</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {lockedCount > 0 && (
                  <Button
                    size="sm"
                    variant="mvInfo"
                    className="h-8 text-xs gap-1"
                    onClick={openUnlockSheet}
                  >
                    <Lock className="size-3" />
                    <span className="hidden sm:inline">Photoshot</span>
                  </Button>
                )}
            </div>
          );
        })()}

        {/* Actions: compact row */}
        <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-border/40">
          {variant === 'showcase' && (
            <>
              
              <Button
                size="sm"
                variant="secondary"
                className="text-xs flex-1"
                onClick={props.onUpdatePrice}
                disabled={props.updateDisabled}
              >
                Update Price
              </Button>
              <Button
                size="sm"
                variant="mvDanger"
                className=" p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                onClick={props.onRemove}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
          {variant === 'inventory' && (
            <Button
              size="sm"
              className="h-7 text-xs w-full"
              onClick={props.onList}
              disabled={!(item as ShowcaseCardInventory).playerProductId || props.listingInFlight}
            >
              {props.listingInFlight ? 'Listing…' : 'Add ShowCase'}
            </Button>
          )}
        </div>
      </div>

       {/* Unlock images: right side panel (Complete Product Photoshot on Model) */}
      {variant === 'showcase' && (
        <Sheet open={unlockSheetOpen} onOpenChange={(open) => !open && closeUnlockSheet()}>
          <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
            <SheetHeader>
              <SheetTitle>Complete Product Photoshot on Model</SheetTitle>
              <SheetDescription>
                Unlock locked images to add them to your listing. Each unlock applies a sales boost of +{UNLOCK_BOOST_PCT}%.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
              {lockedImages.map((img) => {
                const costXp = img.effectiveCostXp ?? img.paidXp;
                const costDiamond = img.effectiveCostDiamond ?? img.paidDiamond;
                const hasXp = costXp != null && costXp >= 0;
                const hasDiamond = costDiamond != null && costDiamond >= 0;
                const payWith = payWithByImageId[img.id];
                const canUnlock = payWith && (payWith === 'XP' ? hasXp : hasDiamond);
                const imageUrl = img.displayUrl ?? img.templateUrl ?? null;
                return (
                  <div key={img.id} className="w-1/2 min-w-[140px] max-w-[180px] space-y-2 rounded-lg border border-border p-2">
                    <div className="aspect-2/3 w-full overflow-hidden rounded-md bg-muted">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="Product"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Tag className="size-8" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Cost</p>
                      {hasXp && hasDiamond && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={payWith === 'XP' ? 'default' : 'outline'}
                            className="h-7 text-xs"
                            onClick={() => setPayWithByImageId((p) => ({ ...p, [img.id]: 'XP' }))}
                          >
                            <Sparkles className="size-3 mr-1" /> {costXp} XP
                          </Button>
                          <Button
                            size="sm"
                            variant={payWith === 'DIAMOND' ? 'default' : 'outline'}
                            className="h-7 text-xs"
                            onClick={() => setPayWithByImageId((p) => ({ ...p, [img.id]: 'DIAMOND' }))}
                          >
                            <Gem className="size-3 mr-1" /> {costDiamond} Diamond
                          </Button>
                        </div>
                      )}
                      {hasXp && !hasDiamond && <p className="text-sm">XP: {costXp}</p>}
                      {hasDiamond && !hasXp && <p className="text-sm">Diamond: {costDiamond}</p>}
                      {!hasXp && !hasDiamond && (
                        <p className="text-xs text-amber-600">Unlock cost not configured.</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Boost: +{UNLOCK_BOOST_PCT}% sales (applied after unlock).
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!canUnlock || unlockingImageId === img.id}
                      onClick={() => payWith && handleUnlock(img, payWith)}
                    >
                      {unlockingImageId === img.id ? 'Unlocking…' : 'Confirm'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
