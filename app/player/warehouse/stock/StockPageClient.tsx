'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export type InventoryItemRow = {
  id: string;
  companyBuildingId: string;
  productTemplateId: string;
  qtyOnHand: number;
  qtyReserved: number;
  avgUnitCost: number;
  lastUnitCost: number;
  productCode: string;
  productName: string;
  thumbnailUrl: string | null;
  /** Total IN (stok giriş) from InventoryMovement */
  totalStock: number;
  /** Total OUT (sold) from InventoryMovement */
  sold: number;
  /** totalStock - sold */
  available: number;
};

export type MovementRow = {
  id: string;
  movementType: 'IN' | 'OUT';
  sourceType: string;
  qtyChange: number;
  unitCost: number | null;
  dayKey: string;
  createdAt: string;
  productCode: string;
  productName: string;
};

type StockPageClientProps = {
  buildingId: string;
  tab: 'inventory' | 'movements' | 'incoming';
  inventory: InventoryItemRow[] | null;
  movements: MovementRow[] | null;
  currentDayKey: string;
  basePath: string;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDayKey(dayKey: string): string {
  try {
    return new Date(dayKey).toISOString().split('T')[0];
  } catch {
    return dayKey;
  }
}

export function StockPageClient({
  buildingId,
  tab,
  inventory,
  movements,
  currentDayKey,
  basePath,
}: StockPageClientProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [detailMovements, setDetailMovements] = useState<MovementRow[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [movementPreset, setMovementPreset] = useState<string>(
    tab === 'incoming' ? 'incoming' : 'in'
  );

  useEffect(() => {
    if (tab === 'incoming') setMovementPreset('incoming');
  }, [tab]);

  const isInventory = tab === 'inventory';
  const isMovements = tab === 'movements' || tab === 'incoming';

  const filteredMovements = useMemo(() => {
    if (!movements || movements.length === 0) return [];
    const today = currentDayKey.split('T')[0];
    switch (movementPreset) {
      case 'incoming':
        return movements.filter(
          (m) => m.movementType === 'IN' && m.dayKey.startsWith(today)
        );
      case 'in':
        return movements.filter((m) => m.movementType === 'IN');
      case 'out':
        return movements.filter((m) => m.movementType === 'OUT');
      case 'last7': {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return movements.filter((m) => {
          const dayStr = m.dayKey.split('T')[0];
          return dayStr >= cutoffStr;
        });
      }
      default:
        return movements;
    }
  }, [movements, movementPreset, currentDayKey]);

  const selectedItem = useMemo(
    () => inventory?.find((i) => i.productTemplateId === selectedProductId) ?? null,
    [inventory, selectedProductId]
  );

  const openDetail = (productTemplateId: string) => {
    setSelectedProductId(productTemplateId);
    setDetailMovements(null);
    setDetailLoading(true);
    fetch(
      `/api/player/warehouse/stock/movements?buildingId=${encodeURIComponent(buildingId)}&productTemplateId=${encodeURIComponent(productTemplateId)}&limit=15`
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDetailMovements(data);
        else setDetailMovements([]);
      })
      .catch(() => setDetailMovements([]))
      .finally(() => setDetailLoading(false));
  };

  const query = (t: string) => {
    const p = new URLSearchParams();
    p.set('buildingId', buildingId);
    if (t !== 'inventory') p.set('tab', t);
    return p.toString();
  };

  return (
    <div className="flex flex-col gap-4 2xl:flex-row">
      {/* Left-side module switch */}
      <nav
        className="shrink-0 lg:w-64 xl:w-48 2xl:w-48"
        aria-label="Stock modules"
      >
        <ul className="flex flex-row gap-1 rounded-lg border bg-muted/30 p-1 xl:flex-col">
          <li>
            <Link
              href={`${basePath}?${query('inventory')}`}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isInventory
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
              )}
            >
              <Package className="h-4 w-4" />
              Inventory
            </Link>
          </li>
          <li>
            <Link
              href={`${basePath}?${query('movements')}`}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isMovements
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
              )}
            >
              <ArrowDownToLine className="h-4 w-4" />
              Movements
            </Link>
          </li>
        </ul>
      </nav>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          {isInventory && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5"
            >
              {inventory && inventory.length > 0 ? (
                inventory.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer border bg-card shadow-sm transition-shadow hover:shadow-md"
                    onClick={() => openDetail(item.productTemplateId)}
                  >
                    <div className="relative aspect-4/5 w-full rounded-t-lg bg-muted">
                      {item.thumbnailUrl ? (
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.productName}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Package className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="truncate text-xs font-medium text-muted-foreground">
                        {item.productCode}
                      </CardTitle>
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.productName}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-1 p-3 pt-0 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total stock</span>
                        <span className="tabular-nums">{item.totalStock}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sold</span>
                        <span className="tabular-nums">{item.sold}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-muted-foreground">Available</span>
                        <span className="tabular-nums">{item.available}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="col-span-full text-sm text-muted-foreground">
                  No inventory items in this warehouse.
                </p>
              )}
            </motion.div>
          )}

          {isMovements && (
            <motion.div
              key="movements"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Filter presets */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={movementPreset === 'incoming' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8"
                  asChild
                >
                  <Link href={`${basePath}?${query('incoming')}`}>
                    Incoming Today
                  </Link>
                </Button>
                <Button
                  variant={movementPreset === 'in' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setMovementPreset('in')}
                >
                  All IN
                </Button>
                <Button
                  variant={movementPreset === 'out' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setMovementPreset('out')}
                >
                  All OUT
                </Button>
                <Button
                  variant={movementPreset === 'last7' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setMovementPreset('last7')}
                >
                  Last 7 days
                </Button>
              </div>

              <div className="rounded-lg border bg-card">
                <ul className="divide-y">
                  {filteredMovements.length > 0 ? (
                    filteredMovements.slice(0, 50).map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
                      >
                        <Badge
                          variant={m.movementType === 'IN' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {m.movementType === 'IN' ? (
                            <ArrowDownToLine className="mr-1 h-3 w-3" />
                          ) : (
                            <ArrowUpFromLine className="mr-1 h-3 w-3" />
                          )}
                          {m.movementType}
                        </Badge>
                        <span className="font-medium tabular-nums">
                          {m.productCode}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {m.productName}
                        </span>
                        <span className="tabular-nums">
                          {m.qtyChange > 0 ? '+' : ''}
                          {m.qtyChange}
                        </span>
                        {m.unitCost != null && (
                          <span className="text-muted-foreground">
                            {formatCurrency(m.unitCost)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {m.sourceType}
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDayKey(m.dayKey)}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No movements match the selected filter.
                    </li>
                  )}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Product detail: desktop right panel (same Sheet for mobile) */}
      <Sheet
        open={!!selectedProductId}
        onOpenChange={(open) => !open && setSelectedProductId(null)}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md p-4"
        >
          {selectedItem && (
            <>
              <SheetHeader>
                <div className="flex gap-3">
                  {selectedItem.thumbnailUrl ? (
                    <div className="relative min-h-16 min-w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={selectedItem.thumbnailUrl}
                        alt={selectedItem.productName}
                        fill
                        className="bg-muted"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate text-base">
                      {selectedItem.productName}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground">
                      {selectedItem.productCode}
                    </p>
                  </div>
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Stock summary
                  </h4>
                  <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total stock</span>
                      <p className="font-semibold tabular-nums">{selectedItem.totalStock}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sold</span>
                      <p className="font-semibold tabular-nums">{selectedItem.sold}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Available</span>
                      <p className="font-semibold tabular-nums">{selectedItem.available}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Cost summary
                  </h4>
                  <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Avg unit cost</span>
                      <p className="font-semibold tabular-nums">
                        {formatCurrency(selectedItem.avgUnitCost)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last unit cost</span>
                      <p className="font-semibold tabular-nums">
                        {formatCurrency(selectedItem.lastUnitCost)}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recent movements
                  </h4>
                  {detailLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : detailMovements && detailMovements.length > 0 ? (
                    <ul className="space-y-2">
                      {detailMovements.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-2 rounded border px-3 py-2 text-xs"
                        >
                          <Badge
                            variant={m.movementType === 'IN' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {m.movementType}
                          </Badge>
                          <span className="tabular-nums">
                            {m.qtyChange > 0 ? '+' : ''}
                            {m.qtyChange}
                          </span>
                          {m.unitCost != null && (
                            <span className="text-muted-foreground">
                              {formatCurrency(m.unitCost)}
                            </span>
                          )}
                          <span className="ml-auto text-muted-foreground">
                            {formatDayKey(m.dayKey)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No recent movements.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
