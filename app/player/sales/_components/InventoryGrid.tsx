'use client';

import { ProductShowcaseCard, type ShowcaseCardInventory } from './ProductShowcaseCard';
import type { ShowcaseImageItem } from './ShowcaseImageCarousel';

export type InventoryItemApi = {
  inventoryItemId: string;
  productTemplateId: string;
  playerProductId: string | null;
  qtyOnHand: number;
  avgUnitCost: string;
  productTemplate: {
    id: string;
    name: string;
    code: string;
    suggestedSalePrice: string;
    productQuality: string;
  } | null;
  images?: Array<{
    id: string;
    isUnlocked: boolean;
    paidXp: number | null;
    paidDiamond: number | null;
    unlockType: string | null;
    urlOverride: string | null;
    templateUrl: string | null;
    displayUrl: string | null;
  }>;
};

function toCardItem(i: InventoryItemApi): ShowcaseCardInventory {
  const images: ShowcaseImageItem[] = (i.images ?? []).map((img) => ({
    id: img.id,
    isUnlocked: img.isUnlocked,
    paidXp: img.paidXp,
    paidDiamond: img.paidDiamond,
    effectiveCostXp: img.paidXp ?? null,
    effectiveCostDiamond: img.paidDiamond ?? null,
    unlockType: img.unlockType ?? null,
    displayUrl: img.displayUrl,
    templateUrl: img.templateUrl ?? null,
  }));
  return {
    inventoryItemId: i.inventoryItemId,
    productName: i.productTemplate?.name ?? i.productTemplateId,
    productCode: i.productTemplate?.code,
    qtyOnHand: i.qtyOnHand,
    suggestedSalePrice: i.productTemplate?.suggestedSalePrice ?? null,
    avgUnitCost: i.avgUnitCost,
    playerProductId: i.playerProductId,
    images: images.length > 0 ? images : undefined,
  };
}

type InventoryGridProps = {
  items: InventoryItemApi[];
  loading: boolean;
  listedPlayerProductIds: Set<string>;
  listingInFlight: string | null;
  onList: (item: InventoryItemApi) => void;
};

function CardSkeleton() {
  return (
    <div className="min-h-[256px] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md animate-pulse">
      <div className="aspect-3/4 w-full bg-muted/50" />
      <div className="flex flex-1 flex-col gap-2 border-t border-border/50 p-3">
        <div className="h-4 w-3/4 rounded bg-muted/50" />
        <div className="h-3 w-1/2 rounded bg-muted/40" />
        <div className="h-5 w-1/4 rounded bg-muted/40 mt-2" />
        <div className="mt-3 pt-2 border-t border-border/40">
          <div className="h-7 w-full rounded bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

export function InventoryGrid({
  items,
  loading,
  listedPlayerProductIds,
  listingInFlight,
  onList,
}: InventoryGridProps) {
  const unlisted = items.filter(
    (i) => !i.playerProductId || !listedPlayerProductIds.has(i.playerProductId)
  );

  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (unlisted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center">
        <p className="text-muted-foreground">No inventory with qty on hand.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {unlisted.map((item) => {
        const card = toCardItem(item);
        return (
          <ProductShowcaseCard
            key={item.inventoryItemId}
            variant="inventory"
            item={card}
            onList={() => onList(item)}
            listingInFlight={listingInFlight === item.inventoryItemId}
          />
        );
      })}
    </div>
  );
}
