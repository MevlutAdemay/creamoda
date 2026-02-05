'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/ToastCenter';
import { SalesTopBar, type WarehouseOption, type SortKey } from './SalesTopBar';
import { SalesTabs } from './SalesTabs';
import { PriceDialog, type PriceDialogMode } from './PriceDialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ShowcaseCardListing, CampaignBadgeItem } from './ProductShowcaseCard';
import type { InventoryItemApi } from './InventoryGrid';

type WarehouseCampaign = {
  id: string;
  warehouseBuildingId: string;
  startDayKey: string;
  endDayKey: string;
  positiveBoostPct: number;
  negativeBoostPct?: number | null;
  title?: string | null;
  status: string;
  packageKeySnapshot?: string | null;
};
type CategoryCampaign = WarehouseCampaign & { categoryNodeId: string };
type ProductCampaign = Omit<WarehouseCampaign, 'warehouseBuildingId'> & { warehouseBuildingId: string; listingId: string };

type ListingApi = {
  id: string;
  marketZone: string;
  warehouseBuildingId: string;
  playerProductId: string;
  productTemplateId: string;
  salePrice: string;
  listPrice?: string | null;
  suggestedSalePrice?: string | null;
  categoryNodeId?: string | null;
  status: string;
  inventoryItemId?: string | null;
  stockQty?: number | null;
  productName?: string;
  productCode?: string;
  positiveBoostPct?: number;
  images?: Array<{
    id: string;
    isUnlocked: boolean;
    paidXp: number | null;
    paidDiamond: number | null;
    effectiveCostXp?: number | null;
    effectiveCostDiamond?: number | null;
    unlockType?: string | null;
    urlOverride: string | null;
    templateUrl: string | null;
    displayUrl: string | null;
  }>;
};

function isActiveCampaign(
  status: string,
  startDayKey: string,
  endDayKey: string,
  dayKey: string | null
): boolean {
  if (!dayKey || (status !== 'SCHEDULED' && status !== 'ACTIVE')) return false;
  return dayKey >= startDayKey && dayKey <= endDayKey;
}

function computeActiveBadges(
  listing: Omit<ShowcaseCardListing, 'activeBadges'>,
  warehouseCampaigns: WarehouseCampaign[],
  categoryCampaigns: CategoryCampaign[],
  productCampaigns: ProductCampaign[],
  dayKey: string | null
): CampaignBadgeItem[] {
  const badges: CampaignBadgeItem[] = [];
  const whId = listing.warehouseBuildingId ?? '';
  const catId = listing.categoryNodeId ?? '';

  const activeProduct = productCampaigns
    .filter((c) => c.listingId === listing.id && isActiveCampaign(c.status, c.startDayKey, c.endDayKey, dayKey))
    .sort((a, b) => (b.positiveBoostPct ?? 0) - (a.positiveBoostPct ?? 0))[0];
  if (activeProduct) {
    badges.push({
      type: 'product',
      title: activeProduct.title ?? null,
      packageKeySnapshot: activeProduct.packageKeySnapshot ?? null,
      positiveBoostPct: activeProduct.positiveBoostPct ?? 0,
      negativeBoostPct: activeProduct.negativeBoostPct ?? null,
      startDayKey: activeProduct.startDayKey,
      endDayKey: activeProduct.endDayKey,
    });
  }

  const activeCategory = categoryCampaigns
    .filter(
      (c) =>
        c.warehouseBuildingId === whId &&
        c.categoryNodeId === catId &&
        isActiveCampaign(c.status, c.startDayKey, c.endDayKey, dayKey)
    )
    .sort((a, b) => (b.positiveBoostPct ?? 0) - (a.positiveBoostPct ?? 0))[0];
  if (activeCategory) {
    badges.push({
      type: 'category',
      title: activeCategory.title ?? null,
      packageKeySnapshot: activeCategory.packageKeySnapshot ?? null,
      positiveBoostPct: activeCategory.positiveBoostPct ?? 0,
      negativeBoostPct: activeCategory.negativeBoostPct ?? null,
      startDayKey: activeCategory.startDayKey,
      endDayKey: activeCategory.endDayKey,
    });
  }

  const activeWarehouse = warehouseCampaigns
    .filter(
      (c) => c.warehouseBuildingId === whId && isActiveCampaign(c.status, c.startDayKey, c.endDayKey, dayKey)
    )
    .sort((a, b) => (b.positiveBoostPct ?? 0) - (a.positiveBoostPct ?? 0))[0];
  if (activeWarehouse) {
    badges.push({
      type: 'warehouse',
      title: activeWarehouse.title ?? null,
      packageKeySnapshot: activeWarehouse.packageKeySnapshot ?? null,
      positiveBoostPct: activeWarehouse.positiveBoostPct ?? 0,
      negativeBoostPct: activeWarehouse.negativeBoostPct ?? null,
      startDayKey: activeWarehouse.startDayKey,
      endDayKey: activeWarehouse.endDayKey,
    });
  }

  return badges.slice(0, 3);
}

function toListingCard(l: ListingApi): Omit<ShowcaseCardListing, 'activeBadges'> {
  return {
    id: l.id,
    marketZone: l.marketZone,
    warehouseBuildingId: l.warehouseBuildingId,
    productName: l.productName ?? l.productTemplateId,
    productCode: l.productCode,
    salePrice: l.salePrice,
    listPrice: l.listPrice ?? null,
    suggestedSalePrice: l.suggestedSalePrice ?? null,
    categoryNodeId: l.categoryNodeId ?? null,
    status: l.status,
    inventoryItemId: l.inventoryItemId ?? null,
    stockQty: l.stockQty ?? null,
    positiveBoostPct: l.positiveBoostPct,
    images: l.images?.map((img) => ({
      id: img.id,
      isUnlocked: img.isUnlocked,
      paidXp: img.paidXp,
      paidDiamond: img.paidDiamond,
      effectiveCostXp: img.effectiveCostXp ?? null,
      effectiveCostDiamond: img.effectiveCostDiamond ?? null,
      unlockType: img.unlockType ?? null,
      displayUrl: img.displayUrl,
      templateUrl: img.templateUrl,
    })),
  };
}

export default function SalesShowcaseClient() {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [inventory, setInventory] = useState<InventoryItemApi[]>([]);
  const [listings, setListings] = useState<ListingApi[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingInFlight, setListingInFlight] = useState<string | null>(null);
  const [updateSaving, setUpdateSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceDialogMode, setPriceDialogMode] = useState<PriceDialogMode>('list');
  const [priceDialogProductName, setPriceDialogProductName] = useState<string>('');
  const [priceDialogInitialSale, setPriceDialogInitialSale] = useState('');
  const [priceDialogSuggestedSalePrice, setPriceDialogSuggestedSalePrice] = useState<number | null>(null);
  const [priceDialogWarehouseName, setPriceDialogWarehouseName] = useState<string | null>(null);
  const [pendingListInventoryItem, setPendingListInventoryItem] = useState<InventoryItemApi | null>(null);
  const [pendingUpdateListing, setPendingUpdateListing] = useState<ShowcaseCardListing | null>(null);
  const [warehouseCampaigns, setWarehouseCampaigns] = useState<WarehouseCampaign[]>([]);
  const [categoryCampaigns, setCategoryCampaigns] = useState<CategoryCampaign[]>([]);
  const [productCampaigns, setProductCampaigns] = useState<ProductCampaign[]>([]);
  const [currentDayKey, setCurrentDayKey] = useState<string | null>(null);
  const toast = useToast();

  const fetchWarehouses = useCallback(async () => {
    const res = await fetch('/api/player/warehouses');
    if (!res.ok) return;
    const data = await res.json();
    const whs: WarehouseOption[] = data.warehouses ?? [];
    setWarehouses(whs);
    if (whs.length > 0 && !warehouseId) setWarehouseId(whs[0].id);
  }, [warehouseId]);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchInventory = useCallback(async () => {
    if (!warehouseId) return;
    setLoadingInv(true);
    try {
      const res = await fetch(
        `/api/player/warehouse-inventory?warehouseBuildingId=${encodeURIComponent(warehouseId)}`
      );
      if (!res.ok) throw new Error('Failed to load inventory');
      const data = await res.json();
      setInventory(data.items ?? []);
    } catch (e) {
      toast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to load inventory',
      });
      setInventory([]);
    } finally {
      setLoadingInv(false);
    }
  }, [warehouseId, toast]);

  const fetchListings = useCallback(async () => {
    if (!warehouseId) return;
    setLoadingListings(true);
    try {
      const res = await fetch(
        `/api/player/showcase-listings?warehouseBuildingId=${encodeURIComponent(warehouseId)}`
      );
      if (!res.ok) throw new Error('Failed to load listings');
      const data = await res.json();
      setListings(data.listings ?? []);
    } catch {
      setListings([]);
    } finally {
      setLoadingListings(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    fetchInventory();
  }, [warehouseId, fetchInventory]);

  useEffect(() => {
    fetchListings();
  }, [warehouseId, fetchListings]);

  const fetchMarketingCampaigns = useCallback(async () => {
    if (!warehouseId) return;
    try {
      const res = await fetch(`/api/player/marketing-campaigns?warehouseBuildingId=${encodeURIComponent(warehouseId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setWarehouseCampaigns(data.warehouseCampaigns ?? []);
      setCategoryCampaigns(data.categoryCampaigns ?? []);
      setProductCampaigns(data.productCampaigns ?? []);
      setCurrentDayKey(data.currentDayKey ?? null);
    } catch {
      setWarehouseCampaigns([]);
      setCategoryCampaigns([]);
      setProductCampaigns([]);
      setCurrentDayKey(null);
    }
  }, [warehouseId]);

  useEffect(() => {
    fetchMarketingCampaigns();
  }, [fetchMarketingCampaigns]);

  const listedPlayerProductIds = new Set(listings.map((l) => l.playerProductId));

  const openListDialog = (item: InventoryItemApi) => {
    const selectedWh = warehouses.find((w) => w.id === warehouseId);
    const multiplier = selectedWh?.priceMultiplier ?? 1;
    const suggestedBase = item.productTemplate?.suggestedSalePrice
      ? parseFloat(item.productTemplate.suggestedSalePrice)
      : 0;
    const suggestedComputed = suggestedBase > 0 ? suggestedBase * multiplier : null;
    const avg = parseFloat(item.avgUnitCost);
    const defaultPrice =
      suggestedComputed != null && suggestedComputed > 0
        ? suggestedComputed.toFixed(2)
        : (avg * 1.8).toFixed(2);
    setPriceDialogMode('list');
    setPriceDialogProductName(item.productTemplate?.name ?? item.productTemplateId);
    setPriceDialogInitialSale(defaultPrice);
    setPriceDialogSuggestedSalePrice(suggestedComputed);
    setPriceDialogWarehouseName(selectedWh?.countryName ?? selectedWh?.name ?? null);
    setPendingListInventoryItem(item);
    setPendingUpdateListing(null);
    setPriceDialogOpen(true);
  };

  const openUpdateDialog = (listing: ShowcaseCardListing) => {
    const selectedWh = warehouses.find((w) => w.id === warehouseId);
    const multiplier = selectedWh?.priceMultiplier ?? 1;
    const suggestedBase = listing.suggestedSalePrice ? parseFloat(listing.suggestedSalePrice) : 0;
    const suggestedComputed = suggestedBase > 0 ? suggestedBase * multiplier : null;
    setPriceDialogMode('update');
    setPriceDialogProductName(listing.productName ?? '');
    setPriceDialogInitialSale(listing.salePrice);
    setPriceDialogSuggestedSalePrice(suggestedComputed);
    setPriceDialogWarehouseName(selectedWh?.countryName ?? selectedWh?.name ?? null);
    setPendingUpdateListing(listing);
    setPendingListInventoryItem(null);
    setPriceDialogOpen(true);
  };

  const handlePriceDialogConfirm = async (salePrice: number) => {
    if (!warehouseId) return;
    if (priceDialogMode === 'list' && pendingListInventoryItem) {
      setListingInFlight(pendingListInventoryItem.inventoryItemId);
      try {
        const res = await fetch('/api/player/showcase-listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseBuildingId: warehouseId,
            inventoryItemId: pendingListInventoryItem.inventoryItemId,
            salePrice,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ kind: 'error', message: data.error ?? 'Failed to list' });
          return;
        }
        toast({ kind: 'success', message: 'Listed successfully' });
        setPriceDialogOpen(false);
        setPendingListInventoryItem(null);
        fetchListings();
        fetchInventory();
      } catch (e) {
        toast({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Failed to list',
        });
      } finally {
        setListingInFlight(null);
      }
      return;
    }
    if (priceDialogMode === 'update' && pendingUpdateListing?.inventoryItemId) {
      setUpdateSaving(true);
      try {
        const res = await fetch('/api/player/showcase-listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseBuildingId: warehouseId,
            inventoryItemId: pendingUpdateListing.inventoryItemId,
            salePrice,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ kind: 'error', message: data.error ?? 'Failed to update price' });
          return;
        }
        toast({ kind: 'success', message: 'Price updated' });
        setPriceDialogOpen(false);
        setPendingUpdateListing(null);
        fetchListings();
      } catch (e) {
        toast({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Failed to update price',
        });
      } finally {
        setUpdateSaving(false);
      }
    }
  };

  const handleRemove = async (listingId: string) => {
    try {
      const res = await fetch(`/api/player/showcase-listings/${listingId}/pause`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast({ kind: 'success', message: 'Listing removed' });
      fetchListings();
      fetchInventory();
    } catch (e) {
      toast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to remove',
      });
    }
  };

  const listingCards: ShowcaseCardListing[] = listings.map((l) => {
    const base = toListingCard(l);
    return {
      ...base,
      activeBadges: computeActiveBadges(
        base,
        warehouseCampaigns,
        categoryCampaigns,
        productCampaigns,
        currentDayKey
      ),
    };
  });

  return (
    <TooltipProvider delayDuration={200}>
    <div className="relative max-h-screen bg-transparent">
      <div className="container mx-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6 min-w-full">
          <SalesTopBar
            warehouseId={warehouseId}
            warehouses={warehouses}
            onWarehouseChange={setWarehouseId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortKey={sortKey}
            onSortChange={setSortKey}
          />
          <SalesTabs
            listings={listingCards}
            inventory={inventory}
            listedPlayerProductIds={listedPlayerProductIds}
            loadingListings={loadingListings}
            loadingInventory={loadingInv}
            searchQuery={searchQuery}
            sortKey={sortKey}
            listingInFlight={listingInFlight}
            updateSaving={updateSaving}
            onList={openListDialog}
            onUpdatePrice={openUpdateDialog}
            onRemove={handleRemove}
            onUnlockSuccess={() => {
              fetchListings();
            }}
          />
          <PriceDialog
            open={priceDialogOpen}
            onOpenChange={setPriceDialogOpen}
            mode={priceDialogMode}
            productName={priceDialogProductName}
            initialSalePrice={priceDialogInitialSale}
            suggestedSalePrice={priceDialogSuggestedSalePrice}
            warehouseName={priceDialogWarehouseName}
            saving={
              (priceDialogMode === 'list' && listingInFlight !== null) ||
              (priceDialogMode === 'update' && updateSaving)
            }
            onConfirm={handlePriceDialogConfirm}
          />
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
