'use client';

import { cn } from '@/lib/utils';

export type WarehouseOption = {
  id: string;
  name: string | null;
  marketZone: string | null;
  countryName: string | null;
};

type Props = {
  warehouses: WarehouseOption[];
  warehouseId: string;
  onWarehouseChange: (id: string) => void;
  skuCount: number | null;
  loadingSku?: boolean;
};

const WAREHOUSE_BLURB =
  'This campaign affects all listed products shipped from this warehouse.';

function warehouseLabel(w: WarehouseOption): string {
  const name = w.countryName ?? w.name ?? w.id.slice(0, 8);
  return w.marketZone != null ? `${name} (${w.marketZone})` : name;
}

export function WarehouseCampaignForm({
  warehouses,
  warehouseId,
  onWarehouseChange,
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
      {warehouseId && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <p className="select-none cursor-default">
            Affected SKUs: <strong>{loadingSku ? '…' : skuCount ?? 0}</strong>
          </p>
          <p className="text-muted-foreground select-none cursor-default">{WAREHOUSE_BLURB}</p>
        </div>
      )}
    </div>
  );
}
