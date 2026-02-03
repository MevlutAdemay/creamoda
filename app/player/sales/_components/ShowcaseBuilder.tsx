// app/player/sales/_components/ShowcaseBuilder.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/ToastCenter';

type WarehouseOption = { id: string; name: string | null; marketZone: string | null };
type InventoryItem = {
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
};
type ListingRow = {
  id: string;
  playerProductId: string;
  marketZone: string;
  productName: string;
  productCode?: string;
  salePrice: string;
  listPrice?: string | null;
  status: string;
  inventoryItemId?: string | null;
};

export default function ShowcaseBuilder() {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [listedIds, setListedIds] = useState<Set<string>>(new Set());
  const [loadingInv, setLoadingInv] = useState(false);
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingInFlight, setListingInFlight] = useState<string | null>(null);
  const [updateModalListing, setUpdateModalListing] = useState<ListingRow | null>(null);
  const [updateSalePrice, setUpdateSalePrice] = useState('');
  const [updateListPrice, setUpdateListPrice] = useState('');
  const [updateSaving, setUpdateSaving] = useState(false);
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
      setPrices((prev) => {
        const next = { ...prev };
        (data.items ?? []).forEach((i: InventoryItem) => {
          if (next[i.inventoryItemId]) return;
          const suggested = i.productTemplate?.suggestedSalePrice;
          const avg = parseFloat(i.avgUnitCost);
          const defaultPrice =
            suggested && parseFloat(suggested) > 0
              ? parseFloat(suggested).toFixed(2)
              : (avg * 1.8).toFixed(2);
          next[i.inventoryItemId] = defaultPrice;
        });
        return next;
      });
    } catch (e) {
      toast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to load inventory' });
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
    } catch (e) {
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

  const handleList = async (item: InventoryItem) => {
    const price = prices[item.inventoryItemId]?.trim();
    if (!price || isNaN(parseFloat(price))) {
      toast({ kind: 'error', message: 'Enter a valid sale price' });
      return;
    }
    setListingInFlight(item.inventoryItemId);
    try {
      const res = await fetch('/api/player/showcase-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseBuildingId: warehouseId,
          inventoryItemId: item.inventoryItemId,
          salePrice: parseFloat(price),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ kind: 'error', message: data.error ?? 'Failed to list' });
        return;
      }
      toast({ kind: 'success', message: 'Listed successfully' });
      setListedIds((prev) => new Set(prev).add(item.playerProductId ?? item.inventoryItemId));
      fetchListings();
    } catch (e) {
      toast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to list' });
    } finally {
      setListingInFlight(null);
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
    } catch (e) {
      toast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to remove' });
    }
  };

  const openUpdateModal = (l: ListingRow) => {
    setUpdateModalListing(l);
    setUpdateSalePrice(l.salePrice);
    setUpdateListPrice(l.listPrice ?? '');
  };

  const handleUpdatePrice = async () => {
    if (!updateModalListing || !warehouseId) return;
    const saleNum = parseFloat(updateSalePrice);
    if (!Number.isFinite(saleNum) || saleNum <= 0) {
      toast({ kind: 'error', message: 'Sale price must be a number greater than 0' });
      return;
    }
    const listVal = updateListPrice.trim();
    const listNum = listVal ? parseFloat(listVal) : undefined;
    if (
      listVal &&
      (listNum === undefined || !Number.isFinite(listNum) || listNum <= 0)
    ) {
      toast({ kind: 'error', message: 'List price must be empty or a number greater than 0' });
      return;
    }
    const listPriceToSend =
      typeof listNum === 'number' && Number.isFinite(listNum) && listNum > 0 ? listNum : undefined;
    const inventoryItemId = updateModalListing.inventoryItemId;
    if (!inventoryItemId) {
      toast({ kind: 'error', message: 'Cannot update: missing inventory item for this listing' });
      return;
    }
    setUpdateSaving(true);
    try {
      const res = await fetch('/api/player/showcase-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseBuildingId: warehouseId,
          inventoryItemId,
          salePrice: saleNum,
          ...(listPriceToSend != null ? { listPrice: listPriceToSend } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ kind: 'error', message: data.error ?? 'Failed to update price' });
        return;
      }
      toast({ kind: 'success', message: 'Price updated' });
      setUpdateModalListing(null);
      fetchListings();
    } catch (e) {
      toast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to update price' });
    } finally {
      setUpdateSaving(false);
    }
  };

  const isAlreadyListed = (item: InventoryItem) =>
    !!item.playerProductId &&
    listings.some((l) => l.playerProductId === item.playerProductId);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const warehouseMarketZone = selectedWarehouse?.marketZone ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name || w.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {warehouseMarketZone != null && (
          <div className="flex items-center h-9 px-2 text-xs text-muted-foreground border rounded-md bg-muted/30">
            Warehouse MarketZone: <span className="ml-1 font-medium text-foreground">{warehouseMarketZone}</span>
          </div>
        )}
        <Button variant="secondary" onClick={fetchInventory} disabled={loadingInv || !warehouseId}>
          {loadingInv ? 'Loading…' : 'Refresh Inventory'}
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Inventory (qty &gt; 0)</h3>
        {!warehouseId ? (
          <p className="text-sm text-muted-foreground">Select a warehouse.</p>
        ) : loadingInv && inventory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : inventory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No inventory with qty on hand.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Avg cost</th>
                  <th className="text-right p-2">Sale price</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => {
                  const alreadyListed = isAlreadyListed(item);
                  return (
                    <tr key={item.inventoryItemId} className="border-b">
                      <td className="p-2">
                        {item.productTemplate?.name ?? item.productTemplateId}
                        {!item.playerProductId && (
                          <span className="block text-xs text-amber-600">
                            No playerProductId — cannot list
                          </span>
                        )}
                      </td>
                      <td className="text-right p-2">{item.qtyOnHand}</td>
                      <td className="text-right p-2">{item.avgUnitCost}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 h-8 text-right"
                          value={prices[item.inventoryItemId] ?? ''}
                          onChange={(e) =>
                            setPrices((prev) => ({
                              ...prev,
                              [item.inventoryItemId]: e.target.value,
                            }))
                          }
                          disabled={!item.playerProductId}
                        />
                      </td>
                      <td className="p-2">
                        {alreadyListed ? (
                          <span className="text-muted-foreground text-xs">Listed</span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={
                              !item.playerProductId ||
                              listingInFlight !== null ||
                              !!listingInFlight
                            }
                            onClick={() => handleList(item)}
                          >
                            {listingInFlight === item.inventoryItemId ? 'Listing…' : 'List'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Current listings (this warehouse)</h3>
        {loadingListings && listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">Zone</th>
                  <th className="text-right p-2">Price</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="p-2">{l.productName ?? l.id}</td>
                    <td className="p-2">{l.marketZone}</td>
                    <td className="text-right p-2">{l.salePrice}</td>
                    <td className="p-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openUpdateModal(l)}
                        disabled={!l.inventoryItemId}
                      >
                        Update
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleRemove(l.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={!!updateModalListing}
        onOpenChange={(open) => {
          if (!open) setUpdateModalListing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Price</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="update-sale-price">Sale Price (required)</Label>
              <Input
                id="update-sale-price"
                type="number"
                step="0.01"
                min="0.01"
                value={updateSalePrice}
                onChange={(e) => setUpdateSalePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="update-list-price">List Price (optional)</Label>
              <Input
                id="update-list-price"
                type="number"
                step="0.01"
                min="0.01"
                value={updateListPrice}
                onChange={(e) => setUpdateListPrice(e.target.value)}
                placeholder="Leave empty for none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpdateModalListing(null)}
              disabled={updateSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdatePrice} disabled={updateSaving}>
              {updateSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
