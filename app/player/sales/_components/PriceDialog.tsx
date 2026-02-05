// app/player/sales/_components/PriceDialog.tsx

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type PriceDialogMode = 'list' | 'update';

type PriceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PriceDialogMode;
  productName?: string;
  /** For list: initial sale price (suggested or avg*1.8). For update: current sale price. */
  initialSalePrice: string;
  /** Suggested sale price for this warehouse (ProductTemplate.suggestedSalePrice × Country.priceMultiplier). Shown as hint. */
  suggestedSalePrice?: number | null;
  /** Warehouse/country name for the suggested price label. */
  warehouseName?: string | null;
  saving: boolean;
  onConfirm: (salePrice: number) => void;
};

export function PriceDialog({
  open,
  onOpenChange,
  mode,
  productName,
  initialSalePrice,
  suggestedSalePrice,
  warehouseName,
  saving,
  onConfirm,
}: PriceDialogProps) {
  const [salePrice, setSalePrice] = useState(initialSalePrice);

  useEffect(() => {
    if (open) {
      setSalePrice(initialSalePrice);
    }
  }, [open, initialSalePrice]);

  const handleConfirm = () => {
    const saleNum = parseFloat(salePrice);
    if (!Number.isFinite(saleNum) || saleNum <= 0) return;
    onConfirm(saleNum);
  };

  const saleNum = parseFloat(salePrice);
  const validSale = Number.isFinite(saleNum) && saleNum > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'list' ? 'List to Showcase' : 'Update Price'}
          </DialogTitle>
        </DialogHeader>
        {productName && (
          <p className="text-sm text-muted-foreground truncate">{productName}</p>
        )}
        <div className="grid gap-4 py-2">
          {suggestedSalePrice != null && Number(suggestedSalePrice) > 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Suggested Sale Price</span>
              {warehouseName ? (
                <span className="text-muted-foreground"> ({warehouseName})</span>
              ) : null}
              :{' '}
              <span className="font-medium">
                €{Number(suggestedSalePrice).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="price-dialog-sale">Sale price (required)</Label>
            <Input
              id="price-dialog-sale"
              type="number"
              step="0.01"
              min="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !validSale}
          >
            {saving ? 'Saving…' : mode === 'list' ? 'List' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
