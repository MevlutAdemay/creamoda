'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, X } from 'lucide-react';
import { CampaignHistoryList, type CampaignHistoryRow } from './_components/CampaignHistoryList';
import { NewCampaignSheet, type CampaignTab } from './_components/NewCampaignSheet';
import type { WarehouseOption } from './warehouse/WarehouseCampaignForm';
import type { CategoryOption } from './category/CategoryCampaignForm';

const TAB_VALUES: CampaignTab[] = ['warehouse', 'category', 'product'];

type Props = {
  warehouses: WarehouseOption[];
  l2Categories: CategoryOption[];
  currentDayKey: string;
};

export default function MarketingPageClient({
  warehouses,
  l2Categories,
  currentDayKey,
}: Props) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as CampaignTab | null;
  const tab: CampaignTab =
    tabParam && TAB_VALUES.includes(tabParam) ? tabParam : 'warehouse';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseCampaigns, setWarehouseCampaigns] = useState<CampaignHistoryRow[]>([]);
  const [categoryCampaigns, setCategoryCampaigns] = useState<CampaignHistoryRow[]>([]);
  const [productCampaigns, setProductCampaigns] = useState<CampaignHistoryRow[]>([]);
  const [loadingWh, setLoadingWh] = useState(false);
  const [loadingCat, setLoadingCat] = useState(false);
  const [loadingProd, setLoadingProd] = useState(false);
  const [warehouseDropdownOpen, setWarehouseDropdownOpen] = useState(false);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  const setTab = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', value);
      window.history.replaceState(null, '', `?${params.toString()}`);
    },
    [searchParams]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        warehouseDropdownRef.current &&
        !warehouseDropdownRef.current.contains(event.target as Node)
      ) {
        setWarehouseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getWarehouseLabel = useCallback(() => {
    if (!warehouseId) return 'All Warehouses';
    const w = warehouses.find((x) => x.id === warehouseId);
    if (!w) return 'All';
    const name = w.countryName ?? w.name ?? w.id.slice(0, 8);
    return w.marketZone != null ? `${name} (${w.marketZone})` : name;
  }, [warehouseId, warehouses]);

  const fetchWarehouseCampaigns = useCallback(async () => {
    setLoadingWh(true);
    try {
      const res = await fetch(
        `/api/player/warehouse-marketing-campaigns?warehouseBuildingId=${encodeURIComponent(warehouseId || '')}`
      );
      const data = res.ok ? await res.json() : { campaigns: [] as Record<string, unknown>[] };
      const raw = (data.campaigns ?? []) as Record<string, unknown>[];
      const list: CampaignHistoryRow[] = raw.map((c) => ({
        id: String(c.id),
        packageKeySnapshot: c.packageKeySnapshot != null ? String(c.packageKeySnapshot) : null,
        title: c.title != null ? String(c.title) : null,
        startDayKey: String(c.startDayKey),
        endDayKey: String(c.endDayKey),
        totalCost: c.totalPriceSnapshot != null ? String(c.totalPriceSnapshot) : null,
        status: String(c.status),
      }));
      setWarehouseCampaigns(list);
    } finally {
      setLoadingWh(false);
    }
  }, [warehouseId]);

  const fetchCategoryCampaigns = useCallback(async () => {
    setLoadingCat(true);
    try {
      const res = await fetch(
        `/api/player/category-marketing-campaigns?warehouseBuildingId=${encodeURIComponent(warehouseId || '')}`
      );
      const data = res.ok ? await res.json() : { campaigns: [] as Record<string, unknown>[] };
      const raw = (data.campaigns ?? []) as Record<string, unknown>[];
      const list: CampaignHistoryRow[] = raw.map((c) => ({
        id: String(c.id),
        packageKeySnapshot: c.packageKeySnapshot != null ? String(c.packageKeySnapshot) : null,
        title: c.title != null ? String(c.title) : null,
        categoryName: c.categoryName != null ? String(c.categoryName) : null,
        startDayKey: String(c.startDayKey),
        endDayKey: String(c.endDayKey),
        totalCost: c.totalPriceSnapshot != null ? String(c.totalPriceSnapshot) : null,
        status: String(c.status),
      }));
      setCategoryCampaigns(list);
    } finally {
      setLoadingCat(false);
    }
  }, [warehouseId]);

  const fetchProductCampaigns = useCallback(async () => {
    setLoadingProd(true);
    try {
      const res = await fetch(
        `/api/player/product-marketing-campaigns?warehouseBuildingId=${encodeURIComponent(warehouseId || '')}`
      );
      const data = res.ok ? await res.json() : { campaigns: [] as Record<string, unknown>[] };
      const raw = (data.campaigns ?? []) as Record<string, unknown>[];
      const list: CampaignHistoryRow[] = raw.map((c) => ({
        id: String(c.id),
        packageKeySnapshot: c.packageKeySnapshot != null ? String(c.packageKeySnapshot) : null,
        title: c.title != null ? String(c.title) : null,
        productName: c.productName != null ? String(c.productName) : null,
        startDayKey: String(c.startDayKey),
        endDayKey: String(c.endDayKey),
        totalCost: c.packagePriceSnapshot != null ? String(c.packagePriceSnapshot) : null,
        status: String(c.status),
      }));
      setProductCampaigns(list);
    } finally {
      setLoadingProd(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    fetchWarehouseCampaigns();
  }, [fetchWarehouseCampaigns]);

  useEffect(() => {
    fetchCategoryCampaigns();
  }, [fetchCategoryCampaigns]);

  useEffect(() => {
    fetchProductCampaigns();
  }, [fetchProductCampaigns]);

  const refreshHistory = useCallback(() => {
    fetchWarehouseCampaigns();
    fetchCategoryCampaigns();
    fetchProductCampaigns();
  }, [fetchWarehouseCampaigns, fetchCategoryCampaigns, fetchProductCampaigns]);

  const hasMultipleWarehouses = warehouses.length > 1;

  return (
    <div className="relative max-h-screen bg-transparent select-none cursor-default">
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6 min-w-full">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h6 className="text-2xl font-bold mb-2 select-none cursor-default">Marketing</h6>
              <p className="text-muted-foreground text-md select-none cursor-default">
                Run warehouse, category, or product campaigns. Immediate boost plus permanent awareness when campaigns end.
              </p>
            </div>
            
          </div>

          {hasMultipleWarehouses && (
            <div className="flex flex-wrap gap-3 items-center">
              <Button onClick={() => setSheetOpen(true)}>New Campaign</Button>
              <div className="relative" ref={warehouseDropdownRef}>
                <Button
                  variant="outline"
                  onClick={() => setWarehouseDropdownOpen((o) => !o)}
                  className="gap-2 min-w-[160px] justify-between"
                >
                  <span className="truncate">{getWarehouseLabel()}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {warehouseId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWarehouseId('');
                          setWarehouseDropdownOpen(false);
                        }}
                        className="rounded-full p-0.5 hover:bg-muted"
                        aria-label="Clear warehouse filter"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        warehouseDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </Button>
                {warehouseDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[220px] bg-popover border border-border rounded-md shadow-lg z-20 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setWarehouseId('');
                        setWarehouseDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                        !warehouseId ? 'bg-accent font-medium' : ''
                      }`}
                    >
                      All Warehouses
                    </button>
                    {warehouses.map((w) => {
                      const label =
                        w.countryName ?? w.name ?? w.id.slice(0, 8);
                      const display =
                        w.marketZone != null ? `${label} (${w.marketZone})` : label;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            setWarehouseId(w.id);
                            setWarehouseDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                            warehouseId === w.id ? 'bg-accent font-medium' : ''
                          }`}
                        >
                          {display}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="warehouse">Warehouse Campaign</TabsTrigger>
              <TabsTrigger value="category">Category Campaign</TabsTrigger>
              <TabsTrigger value="product">Product Campaign</TabsTrigger>
            </TabsList>

            <TabsContent value="warehouse" className="space-y-6 mt-0">
              <div>
                <h2 className="text-lg font-semibold mb-2 select-none cursor-default">Campaign history</h2>
                <CampaignHistoryList
                  tab="warehouse"
                  rows={warehouseCampaigns}
                  currentDayKey={currentDayKey}
                  loading={loadingWh}
                  emptyMessage={warehouseId ? 'No warehouse campaigns yet.' : 'Select a warehouse to see campaigns.'}
                />
              </div>
            </TabsContent>

            <TabsContent value="category" className="space-y-6 mt-0">
              <div>
                <h2 className="text-lg font-semibold mb-2 select-none cursor-default">Campaign history</h2>
                <CampaignHistoryList
                  tab="category"
                  rows={categoryCampaigns}
                  currentDayKey={currentDayKey}
                  loading={loadingCat}
                  emptyMessage={warehouseId ? 'No category campaigns yet.' : 'Select a warehouse to see campaigns.'}
                />
              </div>
            </TabsContent>

            <TabsContent value="product" className="space-y-6 mt-0">
              <div>
                <h2 className="text-lg font-semibold mb-2 select-none cursor-default">Campaign history</h2>
                <CampaignHistoryList
                  tab="product"
                  rows={productCampaigns}
                  currentDayKey={currentDayKey}
                  loading={loadingProd}
                  emptyMessage={warehouseId ? 'No product campaigns yet.' : 'Select a warehouse to see campaigns.'}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <NewCampaignSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        tab={tab}
        warehouses={warehouses}
        categories={l2Categories}
        currentDayKey={currentDayKey}
        onSuccess={refreshHistory}
      />
    </div>
  );
}
