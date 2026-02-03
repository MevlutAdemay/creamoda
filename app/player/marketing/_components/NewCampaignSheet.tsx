'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WarehouseCampaignForm } from '../warehouse/WarehouseCampaignForm';
import { CategoryCampaignForm } from '../category/CategoryCampaignForm';
import { ProductCampaignForm } from '../product/ProductCampaignForm';
import { PackageCarousel } from './PackageCarousel';
import { CampaignSummary, type SummaryTarget, type SummaryPackage, type SummaryDates } from './CampaignSummary';
import { useToast } from '@/components/ui/ToastCenter';
import type { WarehouseOption } from '../warehouse/WarehouseCampaignForm';
import type { CategoryOption } from '../category/CategoryCampaignForm';
import type { ListedProductOption } from '../product/ProductCampaignForm';
import type { PackageItem } from './PackageCard';
import { cn } from '@/lib/utils';

export type CampaignTab = 'warehouse' | 'category' | 'product';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: CampaignTab;
  warehouses: WarehouseOption[];
  categories: CategoryOption[];
  currentDayKey: string;
  onSuccess: () => void;
};

const SCOPE_MAP: Record<CampaignTab, 'WAREHOUSE' | 'CATEGORY' | 'PRODUCT'> = {
  warehouse: 'WAREHOUSE',
  category: 'CATEGORY',
  product: 'PRODUCT',
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayKey(s: string): string {
  try {
    const d = new Date(s + 'T00:00:00Z');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return s;
  }
}

function formatUsd(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function NewCampaignSheet({
  open,
  onOpenChange,
  tab,
  warehouses,
  categories,
  currentDayKey,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryNodeId, setCategoryNodeId] = useState('');
  const [listingId, setListingId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [skuCount, setSkuCount] = useState<number | null>(null);
  const [loadingSku, setLoadingSku] = useState(false);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [totalPrice, setTotalPrice] = useState<string>('0');
  const [loadingTotal, setLoadingTotal] = useState(false);
  const [listedProducts, setListedProducts] = useState<ListedProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const scope = SCOPE_MAP[tab];

  const resetWizard = useCallback(() => {
    setStep(1);
    setWarehouseId('');
    setCategoryNodeId('');
    setListingId('');
    setPackageId('');
    setSkuCount(null);
    setTotalPrice('0');
  }, []);

  useEffect(() => {
    if (!open) return;
    resetWizard();
  }, [open, tab, resetWizard]);

  useEffect(() => {
    if (!open || !warehouseId || tab !== 'product') return;
    setLoadingProducts(true);
    fetch(`/api/player/showcase-listings?warehouseBuildingId=${encodeURIComponent(warehouseId)}`)
      .then((res) => (res.ok ? res.json() : { listings: [] }))
      .then((data) => {
        const list = (data.listing ?? data.listings ?? []).map(
          (l: { id: string; productName?: string; salePrice?: string }) => ({
            id: l.id,
            productName: l.productName ?? l.id.slice(0, 8),
            salePrice: l.salePrice ?? '—',
          })
        );
        setListedProducts(list);
      })
      .finally(() => setLoadingProducts(false));
  }, [open, warehouseId, tab]);

  useEffect(() => {
    if (!open || step !== 1) return;
    if (tab === 'warehouse' && !warehouseId) {
      setSkuCount(null);
      return;
    }
    if (tab === 'category' && (!warehouseId || !categoryNodeId)) {
      setSkuCount(null);
      return;
    }
    if (tab === 'product') {
      setSkuCount(listingId ? 1 : null);
      return;
    }
    setLoadingSku(true);
    const params = new URLSearchParams({
      scope,
      warehouseBuildingId: warehouseId,
      ...(tab === 'category' && categoryNodeId ? { categoryNodeId } : {}),
    });
    fetch(`/api/player/marketing-pricing-preview?${params}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { skuCount?: number }) => {
        setSkuCount(data.skuCount ?? 0);
      })
      .finally(() => setLoadingSku(false));
  }, [open, step, tab, warehouseId, categoryNodeId, listingId, scope]);

  useEffect(() => {
    if (!open || scope == null) return;
    setLoadingPackages(true);
    fetch(`/api/player/marketing-packages?scope=${scope}`)
      .then((res) => (res.ok ? res.json() : { packages: [] }))
      .then((data) => {
        const pkgs = (data.packages ?? []).map((p: Record<string, unknown>) => ({
          id: p.id,
          key: p.key,
          title: p.title,
          durationDays: p.durationDays,
          positiveBoostPct: p.positiveBoostPct,
          priceUsd: p.priceUsd?.toString?.() ?? p.priceUsd,
          awarenessGainDec: p.awarenessGainDec?.toString?.() ?? p.awarenessGainDec ?? '0',
          sortIndex: p.sortIndex ?? 0,
        }));
        setPackages(pkgs);
      })
      .finally(() => setLoadingPackages(false));
  }, [open, scope]);

  useEffect(() => {
    if (step !== 3 || !packageId) {
      setTotalPrice('0');
      return;
    }
    if (tab === 'warehouse' && !warehouseId) return;
    if (tab === 'category' && (!warehouseId || !categoryNodeId)) return;
    if (tab === 'product' && (!warehouseId || !listingId)) return;
    setLoadingTotal(true);
    const params = new URLSearchParams({
      scope,
      packageId,
      warehouseBuildingId: warehouseId,
      ...(tab === 'category' && categoryNodeId ? { categoryNodeId } : {}),
    });
    fetch(`/api/player/marketing-pricing-preview?${params}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { totalPrice?: string; basePrice?: string }) => {
        const total = data.totalPrice ?? data.basePrice ?? '0';
        setTotalPrice(String(total));
      })
      .finally(() => setLoadingTotal(false));
  }, [step, packageId, tab, warehouseId, categoryNodeId, listingId, scope]);

  const canProceedStep1 =
    tab === 'warehouse'
      ? !!warehouseId
      : tab === 'category'
        ? !!warehouseId && !!categoryNodeId
        : !!warehouseId && !!listingId;

  const handleNext = () => {
    if (step === 1 && canProceedStep1) setStep(2);
    else if (step === 2 && packageId) setStep(3);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleSubmit = async () => {
    if (tab === 'warehouse') {
      if (!warehouseId || !packageId) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/player/warehouse-marketing-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ warehouseBuildingId: warehouseId, packageId }),
        });
        const data = await res.json();
        if (res.status === 409) {
          toast({ kind: 'error', message: data.error ?? 'Campaign already exists for this period.' });
          return;
        }
        if (res.status === 400 && String(data.error ?? '').toLowerCase().includes('insufficient')) {
          toast({ kind: 'error', message: data.error ?? 'Insufficient funds' });
          return;
        }
        if (!res.ok) {
          toast({ kind: 'error', message: data.error ?? 'Failed to create campaign' });
          return;
        }
        const cost = data.totalPriceUsd != null ? formatUsd(String(data.totalPriceUsd)) : '';
        toast({ kind: 'success', message: cost ? `Campaign started. Cost: ${cost}` : 'Campaign started' });
        onSuccess();
        onOpenChange(false);
      } catch (e) {
        toast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to create campaign' });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (tab === 'category') {
      if (!warehouseId || !categoryNodeId || !packageId) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/player/category-marketing-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseBuildingId: warehouseId,
            categoryNodeId,
            packageId,
          }),
        });
        const data = await res.json();
        if (res.status === 409) {
          toast({ kind: 'error', message: data.error ?? 'Campaign already exists for this period.' });
          return;
        }
        if (res.status === 400 && String(data.error ?? '').toLowerCase().includes('insufficient')) {
          toast({ kind: 'error', message: data.error ?? 'Insufficient funds' });
          return;
        }
        if (!res.ok) {
          toast({ kind: 'error', message: data.error ?? 'Failed to create campaign' });
          return;
        }
        const cost = data.totalPriceUsd != null ? formatUsd(String(data.totalPriceUsd)) : '';
        toast({ kind: 'success', message: cost ? `Category campaign started. Cost: ${cost}` : 'Category campaign started' });
        onSuccess();
        onOpenChange(false);
      } catch (e) {
        toast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to create campaign' });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (tab === 'product') {
      if (!warehouseId || !listingId || !packageId) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/player/product-marketing-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseBuildingId: warehouseId,
            listingId,
            packageId,
          }),
        });
        const data = await res.json();
        if (res.status === 409) {
          toast({ kind: 'error', message: data.error ?? 'Campaign already exists for this product in the selected period.' });
          return;
        }
        if (res.status === 400 && String(data.error ?? '').toLowerCase().includes('insufficient')) {
          toast({ kind: 'error', message: data.error ?? 'Insufficient funds' });
          return;
        }
        if (!res.ok) {
          toast({ kind: 'error', message: data.error ?? 'Failed to create campaign' });
          return;
        }
        const cost = data.totalPriceUsd != null ? formatUsd(String(data.totalPriceUsd)) : '';
        toast({ kind: 'success', message: cost ? `Sponsored product campaign started. Cost: ${cost}` : 'Sponsored product campaign started' });
        onSuccess();
        onOpenChange(false);
      } catch (e) {
        toast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to create campaign' });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const selectedPackage = packages.find((p) => p.id === packageId);
  const warehouseName = warehouses.find((w) => w.id === warehouseId)?.name ?? warehouses.find((w) => w.id === warehouseId)?.countryName ?? undefined;
  const categoryName = categories.find((c) => c.id === categoryNodeId)?.name;
  const productName = listedProducts.find((p) => p.id === listingId)?.productName;
  const durationDays = selectedPackage?.durationDays ?? 0;
  const endDayKey = currentDayKey && durationDays ? addDays(currentDayKey, durationDays - 1) : currentDayKey;

  const summaryTarget: SummaryTarget = {
    type: tab,
    warehouseName,
    categoryName,
    productName,
  };
  const summaryPackage: SummaryPackage | null = selectedPackage
    ? {
        name: selectedPackage.title,
        key: selectedPackage.key,
        boostPct: selectedPackage.positiveBoostPct,
        durationDays: selectedPackage.durationDays,
        awarenessGainDec: selectedPackage.awarenessGainDec,
      }
    : null;
  const summaryDates: SummaryDates = {
    startDayKey: currentDayKey,
    endDayKey,
  };

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetWizard();
      onOpenChange(next);
    },
    [onOpenChange, resetWizard]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'fixed z-50 flex flex-col bg-background shadow-lg outline-none overflow-hidden',
          'inset-0 translate-x-0 translate-y-0 w-screen h-dvh max-w-none rounded-none border-0 shadow-none p-0',
          'sm:inset-auto sm:top-[50%] sm:left-[50%] sm:right-auto sm:bottom-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[min(1100px,96vw)] sm:max-h-[90vh] sm:h-auto sm:rounded-xl sm:border sm:shadow-lg sm:p-6',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200'
        )}
      >
        <DialogHeader className="shrink-0 px-4 pt-4 sm:px-0 sm:pt-0">
          <DialogTitle className="select-none cursor-default">New Campaign</DialogTitle>
          <DialogDescription className="select-none cursor-default">
            Step {step} of 3: {step === 1 ? 'Target' : step === 2 ? 'Package' : 'Confirm'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-0 sm:py-4">
          {step === 1 && (
            <>
              {tab === 'warehouse' && (
                <WarehouseCampaignForm
                  warehouses={warehouses}
                  warehouseId={warehouseId}
                  onWarehouseChange={setWarehouseId}
                  skuCount={skuCount}
                  loadingSku={loadingSku}
                />
              )}
              {tab === 'category' && (
                <CategoryCampaignForm
                  warehouses={warehouses}
                  categories={categories}
                  warehouseId={warehouseId}
                  categoryNodeId={categoryNodeId}
                  onWarehouseChange={setWarehouseId}
                  onCategoryChange={setCategoryNodeId}
                  skuCount={skuCount}
                  loadingSku={loadingSku}
                />
              )}
              {tab === 'product' && (
                <ProductCampaignForm
                  warehouses={warehouses}
                  products={listedProducts}
                  warehouseId={warehouseId}
                  listingId={listingId}
                  onWarehouseChange={setWarehouseId}
                  onListingChange={setListingId}
                  loadingProducts={loadingProducts}
                />
              )}
            </>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground select-none cursor-default">
                How aggressive is this campaign?
              </p>
              <div className="overflow-hidden max-w-[420px] mx-auto sm:max-w-none">
                <PackageCarousel
                  packages={packages}
                  value={packageId}
                  onChange={setPackageId}
                  formatUsd={formatUsd}
                  loading={loadingPackages}
                />
              </div>
            </div>
          )}
          {step === 3 && summaryPackage && (
            <div className="space-y-4">
              <CampaignSummary
                target={summaryTarget}
                affectedSkus={tab === 'product' ? 1 : skuCount ?? 0}
                pkg={summaryPackage}
                dates={summaryDates}
                estimatedTotalCost={loadingTotal ? '0' : totalPrice}
                formatUsd={formatUsd}
                formatDayKey={formatDayKey}
              />
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 flex-row gap-2 sm:justify-between border-t pt-4 px-4 pb-4 sm:px-0 sm:pb-0">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={handleBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={
                step === 1 ? !canProceedStep1 : step === 2 ? !packageId : false
              }
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || loadingTotal}
            >
              {submitting ? 'Starting…' : 'Start Campaign'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
