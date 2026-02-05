'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { cn } from '@/lib/utils';

export type WarehouseOption = {
  id: string;
  name: string | null;
  marketZone: string | null;
  countryName: string | null;
};

export type ListedProductOption = {
  id: string;
  productName: string;
  salePrice: string;
};

type Props = {
  warehouses: WarehouseOption[];
  products: ListedProductOption[];
  warehouseId: string;
  listingId: string;
  onWarehouseChange: (id: string) => void;
  onListingChange: (id: string) => void;
  loadingProducts?: boolean;
};

const PRODUCT_BLURB = 'This campaign promotes a single product.';

function warehouseLabel(w: WarehouseOption): string {
  const name = w.countryName ?? w.name ?? w.id.slice(0, 8);
  return w.marketZone != null ? `${name} (${w.marketZone})` : name;
}

export function ProductCampaignForm({
  warehouses,
  products,
  warehouseId,
  listingId,
  onWarehouseChange,
  onListingChange,
  loadingProducts,
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
        <p className="text-sm font-medium select-none cursor-default">Product</p>
        {loadingProducts ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 max-w-md">
            <ModaVerseLogoLoader size={22} className="text-primary shrink-0" />
            <span className="text-sm text-muted-foreground">Loading products…</span>
          </div>
        ) : (
        <Select
          value={listingId || undefined}
          onValueChange={onListingChange}
          disabled={!warehouseId}
        >
          <SelectTrigger id="prod-campaign-product" className="w-full max-w-md" aria-label="Product">
            <SelectValue
              placeholder={
                products.length === 0
                  ? 'No LISTED products in this warehouse'
                  : 'Select product'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.productName} — ${p.salePrice}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}
      </div>
      {warehouseId && listingId && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <p className="select-none cursor-default">
            Affected SKUs: <strong>1</strong>
          </p>
          <p className="text-muted-foreground select-none cursor-default">{PRODUCT_BLURB}</p>
        </div>
      )}
    </div>
  );
}
