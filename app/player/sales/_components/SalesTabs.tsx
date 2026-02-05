'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShowcaseGrid } from './ShowcaseGrid';
import { InventoryGrid, type InventoryItemApi } from './InventoryGrid';
import type { ShowcaseCardListing } from './ProductShowcaseCard';
import type { SortKey } from './SalesTopBar';

type SalesTabsProps = {
  listings: ShowcaseCardListing[];
  inventory: InventoryItemApi[];
  listedPlayerProductIds: Set<string>;
  loadingListings: boolean;
  loadingInventory: boolean;
  searchQuery: string;
  sortKey: SortKey;
  listingInFlight: string | null;
  updateSaving: boolean;
  onList: (item: InventoryItemApi) => void;
  onUpdatePrice: (listing: ShowcaseCardListing) => void;
  onRemove: (listingId: string) => void;
  onUnlockSuccess?: () => void;
};

function filterBySearch<T extends { productName?: string; productCode?: string }>(
  items: T[],
  q: string
): T[] {
  const lower = q.trim().toLowerCase();
  if (!lower) return items;
  return items.filter((i) => {
    const name = (i.productName ?? '').toLowerCase();
    const code = (i.productCode ?? '').toLowerCase();
    return name.includes(lower) || code.includes(lower);
  });
}

function sortListings(listings: ShowcaseCardListing[], sortKey: SortKey): ShowcaseCardListing[] {
  const arr = [...listings];
  if (sortKey === 'default') return arr;
  if (sortKey === 'price') {
    arr.sort((a, b) => parseFloat(a.salePrice) - parseFloat(b.salePrice));
    return arr;
  }
  if (sortKey === 'name') {
    arr.sort((a, b) => (a.productName ?? '').localeCompare(b.productName ?? ''));
    return arr;
  }
  return arr;
}

function sortInventory(items: InventoryItemApi[], sortKey: SortKey): InventoryItemApi[] {
  const arr = [...items];
  if (sortKey === 'default') return arr;
  if (sortKey === 'stock') {
    arr.sort((a, b) => b.qtyOnHand - a.qtyOnHand);
    return arr;
  }
  if (sortKey === 'price') {
    arr.sort((a, b) => {
      const pa = a.productTemplate?.suggestedSalePrice
        ? parseFloat(a.productTemplate.suggestedSalePrice)
        : parseFloat(a.avgUnitCost) * 1.8;
      const pb = b.productTemplate?.suggestedSalePrice
        ? parseFloat(b.productTemplate.suggestedSalePrice)
        : parseFloat(b.avgUnitCost) * 1.8;
      return pa - pb;
    });
    return arr;
  }
  if (sortKey === 'name') {
    arr.sort((a, b) =>
      (a.productTemplate?.name ?? a.productTemplateId).localeCompare(
        b.productTemplate?.name ?? b.productTemplateId
      )
    );
    return arr;
  }
  return arr;
}

export function SalesTabs({
  listings,
  inventory,
  listedPlayerProductIds,
  loadingListings,
  loadingInventory,
  searchQuery,
  sortKey,
  listingInFlight,
  updateSaving,
  onList,
  onUpdatePrice,
  onRemove,
  onUnlockSuccess,
}: SalesTabsProps) {
  const filteredListings = filterBySearch(listings, searchQuery);
  const sortedListings = sortListings(filteredListings, sortKey);

  const unlistedInventory = inventory.filter(
    (i) => !i.playerProductId || !listedPlayerProductIds.has(i.playerProductId)
  );
  const filteredInventory = filterBySearch(
    unlistedInventory.map((i) => ({
      ...i,
      productName: i.productTemplate?.name ?? i.productTemplateId,
      productCode: i.productTemplate?.code ?? '',
    })),
    searchQuery
  );
  const sortedInventory = sortInventory(filteredInventory, sortKey);

  return (
    <Tabs defaultValue="showcase" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="showcase">Showcase</TabsTrigger>
        <TabsTrigger value="inventory">Inventory Pool</TabsTrigger>
      </TabsList>
      <TabsContent value="showcase">
        <ShowcaseGrid
          listings={sortedListings}
          loading={loadingListings}
          onUpdatePrice={onUpdatePrice}
          onRemove={onRemove}
          onUnlockSuccess={onUnlockSuccess}
          updateDisabled={updateSaving}
        />
      </TabsContent>
      <TabsContent value="inventory">
        <InventoryGrid
          items={sortedInventory}
          loading={loadingInventory}
          listedPlayerProductIds={listedPlayerProductIds}
          listingInFlight={listingInFlight}
          onList={onList}
        />
      </TabsContent>
    </Tabs>
  );
}
