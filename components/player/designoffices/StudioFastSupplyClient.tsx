'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ProductCard from '@/components/ui/ProductCard';
import { useToast } from '@/components/ui/ToastCenter';
import { Minus, Plus } from 'lucide-react';
import type { Product } from '@/types';

const MIN_QTY = 20;
const QTY_STEP = 10;
const FAST_SUPPLY_WAREHOUSE_KEY = 'fastSupplyWarehouseId';

export type CartLine = {
  productTemplateId: string;
  productCode: string;
  productName: string;
  qty: number;
  unitCost: number;
  mainImageUrl?: string;
};

export type WarehouseOption = {
  id: string;
  name: string | null;
  countryId: string;
};

type FastSupplyContextValue = {
  /** Add product to fast supply cart. Optional qty defaults to MIN_QTY (20). */
  addToCart: (product: Product, qty?: number) => void;
  fastSupplyMultiplier: number;
  canFastSupply: boolean;
};

const FastSupplyContext = React.createContext<FastSupplyContextValue | null>(null);

export function useFastSupply() {
  return React.useContext(FastSupplyContext);
}

function getInitialSelectedWarehouseId(warehouses: WarehouseOption[]): string | null {
  if (warehouses.length === 0) return null;
  if (warehouses.length === 1) return warehouses[0].id;
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem(FAST_SUPPLY_WAREHOUSE_KEY);
  if (saved && warehouses.some((w) => w.id === saved)) return saved;
  return null;
}

type StudioFastSupplyClientProps = {
  studioId: string;
  fastSupplyMultiplier: number;
  warehouses: WarehouseOption[];
  companyId: string | null;
  children: React.ReactNode;
};

export function StudioFastSupplyClient({
  studioId,
  fastSupplyMultiplier,
  warehouses,
  companyId,
  children,
}: StudioFastSupplyClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [purchasing, setPurchasing] = React.useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string | null>(() =>
    getInitialSelectedWarehouseId(warehouses)
  );

  React.useEffect(() => {
    setSelectedWarehouseId((prev) => {
      if (warehouses.length === 0) return null;
      if (prev && warehouses.some((w) => w.id === prev)) return prev;
      return getInitialSelectedWarehouseId(warehouses);
    });
  }, [warehouses]);

  const addToCart = React.useCallback(
    (product: Product, qty: number = MIN_QTY) => {
      const baseCost = (product as any).baseCost as number | null | undefined;
      if (baseCost == null || typeof baseCost !== 'number') return;
      const effectiveQty = Math.max(MIN_QTY, Math.round(qty));
      const unitCost = Number((baseCost * fastSupplyMultiplier).toFixed(2));
      const mainImageUrl =
        (product as any).imageUrl ??
        (Array.isArray((product as any).imageUrls) && (product as any).imageUrls?.length > 0
          ? (product as any).imageUrls[0]
          : undefined);

      setCart((prev) => {
        const existing = prev.find((l) => l.productTemplateId === product.id);
        if (existing) {
          return prev.map((l) =>
            l.productTemplateId === product.id ? { ...l, qty: l.qty + effectiveQty } : l
          );
        }
        return [
          ...prev,
          {
            productTemplateId: product.id,
            productCode: (product.code ?? product.id) as string,
            productName: product.name,
            qty: effectiveQty,
            unitCost,
            mainImageUrl,
          },
        ];
      });
      setDrawerOpen(true);
    },
    [fastSupplyMultiplier]
  );

  const updateQty = React.useCallback((productTemplateId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.productTemplateId !== productTemplateId) return l;
          const newQty = l.qty + delta;
          if (newQty < MIN_QTY) return null;
          return { ...l, qty: newQty };
        })
        .filter((l): l is CartLine => l != null)
    );
  }, []);

  const grandTotal = React.useMemo(() => {
    return cart.reduce((sum, l) => sum + l.unitCost * l.qty, 0);
  }, [cart]);

  const handleWarehouseChange = React.useCallback((value: string) => {
    setSelectedWarehouseId(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FAST_SUPPLY_WAREHOUSE_KEY, value);
    }
  }, []);

  const handlePurchase = React.useCallback(async () => {
    if (!companyId || cart.length === 0 || !selectedWarehouseId) return;
    setPurchasing(true);
    const idempotencyKey = `fast-supply:${studioId}:${selectedWarehouseId}:${Date.now()}:${cart.map((l) => `${l.productTemplateId}:${l.qty}`).join(',')}`;
    try {
      const res = await fetch('/api/player/fast-supply-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId,
          warehouseBuildingId: selectedWarehouseId,
          lines: cart.map((l) => ({ productTemplateId: l.productTemplateId, qty: l.qty })),
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', message: data.error ?? 'Purchase failed', kind: 'error' });
        return;
      }
      setCart([]);
      setDrawerOpen(false);
      toast({ title: 'Success', message: 'Purchased and added to stock.', kind: 'success' });
      router.refresh();
    } catch (e) {
      toast({ title: 'Error', message: 'Purchase failed', kind: 'error' });
    } finally {
      setPurchasing(false);
    }
  }, [companyId, studioId, selectedWarehouseId, cart, router, toast]);

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (cart.length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [cart.length]);

  React.useEffect(() => {
    return () => setCart([]);
  }, []);

  const canFastSupply = Boolean(companyId && warehouses.length > 0);
  const contextValue = React.useMemo<FastSupplyContextValue>(
    () => ({ addToCart, fastSupplyMultiplier, canFastSupply }),
    [addToCart, fastSupplyMultiplier, canFastSupply]
  );

  return (
    <FastSupplyContext.Provider value={contextValue}>
      {children}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex flex-col w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Fast Supply Cart</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            {warehouses.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Deliver to warehouse</label>
                <Select
                  value={selectedWarehouseId ?? ''}
                  onValueChange={handleWarehouseChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={warehouses.length === 1 ? undefined : 'Select warehouse'} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name || `Warehouse (${w.id.slice(0, 8)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cart is empty.</p>
            ) : (
              <ul className="space-y-4">
                {cart.map((line) => (
                  <li key={line.productTemplateId} className="flex gap-3 border-b pb-4">
                    <div className="shrink-0 w-16 h-16 rounded-md bg-muted overflow-hidden">
                      {line.mainImageUrl ? (
                        <img
                          src={line.mainImageUrl}
                          alt={line.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="text-sm font-medium truncate">{line.productCode}</div>
                      <div className="text-xs text-muted-foreground truncate">{line.productName}</div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQty(line.productTemplateId, -QTY_STEP)}
                            disabled={line.qty <= MIN_QTY}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-8 text-center tabular-nums">{line.qty}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQty(line.productTemplateId, QTY_STEP)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right text-xs">
                          <div>
                            €{(line.unitCost * line.qty).toLocaleString('tr-TR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-muted-foreground">
                            €{line.unitCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}/unit
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {cart.length > 0 && (
            <SheetFooter className="border-t pt-4 flex flex-col gap-2 sm:flex-col">
              <div className="flex justify-between text-sm font-semibold">
                <span>Grand total</span>
                <span>
                  €{grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <Button
                onClick={handlePurchase}
                disabled={purchasing || !companyId || !selectedWarehouseId || cart.length === 0}
                className="w-full"
              >
                {purchasing ? 'Processing…' : 'Buy / Purchase'}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </FastSupplyContext.Provider>
  );
}

type StudioFastSupplyGridProps = {
  products: Product[];
  companyId: string | null;
  playerXp: number;
  playerDiamonds: number;
};

export function StudioFastSupplyGrid({
  products,
  companyId,
  playerXp,
  playerDiamonds,
}: StudioFastSupplyGridProps) {
  const ctx = useFastSupply();
  if (!ctx) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            templateId={product.id}
            companyId={companyId ?? undefined}
            playerXp={playerXp}
            playerDiamonds={playerDiamonds}
          />
        ))}
      </div>
    );
  }
  const { addToCart, fastSupplyMultiplier, canFastSupply } = ctx;
  const productsWithWholesale = products.map((p) => {
    const baseCost = (p as any).baseCost as number | null | undefined;
    const wholesalePrice =
      canFastSupply && baseCost != null && typeof baseCost === 'number'
        ? Number((baseCost * fastSupplyMultiplier).toFixed(2))
        : null;
    return { ...p, wholesalePrice };
  });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {productsWithWholesale.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          templateId={product.id}
          companyId={companyId ?? undefined}
          playerXp={playerXp}
          playerDiamonds={playerDiamonds}
          wholesalePrice={product.wholesalePrice ?? null}
          onAddToCart={canFastSupply ? addToCart : undefined}
        />
      ))}
    </div>
  );
}
