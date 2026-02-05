'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export type WarehouseOption = {
  id: string;
  name: string | null;
  marketZone: string | null;
  countryName?: string | null;
  priceMultiplier: number;
};

export type SortKey = 'default' | 'price' | 'stock' | 'name';

type SalesTopBarProps = {
  warehouseId: string;
  warehouses: WarehouseOption[];
  onWarehouseChange: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortKey: SortKey;
  onSortChange: (k: SortKey) => void;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'price', label: 'Price' },
  { value: 'stock', label: 'Stock' },
  { value: 'name', label: 'Name' },
];

export function SalesTopBar({
  warehouseId,
  warehouses,
  onWarehouseChange,
  searchQuery,
  onSearchChange,
  sortKey,
  onSortChange,
}: SalesTopBarProps) {
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const marketZone = selectedWarehouse?.marketZone ?? null;

  return (
    <div className="space-y-2">
      <div className="flex flex-row items-center justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Showcase</h1>
        <p className="text-muted-foreground text-sm hidden sm:block">
          List products from warehouse inventory to the showcase. Advance the day to generate sales.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
          <Select value={warehouseId} onValueChange={onWarehouseChange}>
            <SelectTrigger className="w-[220px]">
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
        
        <div className="flex-1 min-w-[200px] mt-6">
          <Input
            placeholder="Search code or name…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex flex-row items-center gap-1 mt-6">
          <label className="text-xs font-medium text-muted-foreground hidden sm:block">Sort :</label>
          <Select value={sortKey} onValueChange={(v) => onSortChange(v as SortKey)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
