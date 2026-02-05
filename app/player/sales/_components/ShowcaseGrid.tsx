'use client';

import { ProductShowcaseCard, type ShowcaseCardListing } from './ProductShowcaseCard';

type ShowcaseGridProps = {
  listings: ShowcaseCardListing[];
  loading: boolean;
  onUpdatePrice: (listing: ShowcaseCardListing) => void;
  onRemove: (listingId: string) => void;
  onUnlockSuccess?: () => void;
  updateDisabled?: boolean;
};

function CardSkeleton() {
  return (
    <div className="min-h-[256px] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md animate-pulse">
      <div className="aspect-2/3 w-full bg-muted/50" />
      <div className="flex flex-1 flex-col gap-2 border-t border-border/50 p-3">
        <div className="h-4 w-3/4 rounded bg-muted/50" />
        <div className="h-3 w-1/2 rounded bg-muted/40" />
        <div className="h-6 w-1/3 rounded bg-muted/40 mt-2" />
        <div className="mt-3 flex gap-2 pt-2 border-t border-border/40">
          <div className="h-7 flex-1 rounded bg-muted/40" />
          <div className="h-7 w-7 rounded bg-muted/30" />
        </div>
      </div>
    </div>
  );
}

export function ShowcaseGrid({
  listings,
  loading,
  onUpdatePrice,
  onRemove,
  onUnlockSuccess,
  updateDisabled,
}: ShowcaseGridProps) {
  if (loading && listings.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center">
        <p className="text-muted-foreground">No listed products in this warehouse.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {listings.map((l) => (
        <ProductShowcaseCard
          key={l.id}
          variant="showcase"
          item={l}
          onUpdatePrice={() => onUpdatePrice(l)}
          onRemove={() => onRemove(l.id)}
          onUnlockSuccess={onUnlockSuccess}
          updateDisabled={updateDisabled || !l.inventoryItemId}
        />
      ))}
    </div>
  );
}
