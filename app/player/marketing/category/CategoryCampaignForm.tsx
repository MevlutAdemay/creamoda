'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type WarehouseOption = {
  id: string;
  name: string | null;
  marketZone: string | null;
  countryName: string | null;
};

export type CategoryOption = {
  id: string;
  name: string;
  parentName?: string | null;
};

type Props = {
  warehouses: WarehouseOption[];
  categories: CategoryOption[];
  warehouseId: string;
  categoryNodeId: string;
  onWarehouseChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
  skuCount: number | null;
  loadingSku?: boolean;
};

const CATEGORY_BLURB =
  'This campaign affects all listed products in the selected category.';

function warehouseLabel(w: WarehouseOption): string {
  const name = w.countryName ?? w.name ?? w.id.slice(0, 8);
  return w.marketZone != null ? `${name} (${w.marketZone})` : name;
}

export function CategoryCampaignForm({
  warehouses,
  categories,
  warehouseId,
  categoryNodeId,
  onWarehouseChange,
  onCategoryChange,
  skuCount,
  loadingSku,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium select-none cursor-default">Warehouse</p>
      <div className="flex flex-wrap gap-3">
        {warehouses.map((w) => {
          const selected = warehouseId === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onWarehouseChange(w.id)}
              className={cn(
                'rounded-lg border p-4 text-left transition-all min-w-[180px]',
                'hover:border-primary/50 hover:bg-muted/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected && 'border-primary bg-primary/5 ring-2 ring-primary/30'
              )}
            >
              <span className="font-medium text-sm select-none cursor-default block truncate">
                {warehouseLabel(w)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium select-none cursor-default">Category</p>
        <Select
          value={categoryNodeId || undefined}
          onValueChange={onCategoryChange}
          disabled={!warehouseId}
        >
          <SelectTrigger id="cat-campaign-category" className="w-full max-w-xs">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.parentName != null ? ` (${c.parentName})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {warehouseId && categoryNodeId && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <p className="select-none cursor-default">
            Affected SKUs: <strong>{loadingSku ? '…' : skuCount ?? 0}</strong>
          </p>
          <p className="text-muted-foreground select-none cursor-default">{CATEGORY_BLURB}</p>
        </div>
      )}
    </div>
  );
}
