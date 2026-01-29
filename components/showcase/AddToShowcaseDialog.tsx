/**
 * Add to Showcase Dialog
 * Allows player to confirm and set price before listing
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';

type AddToShowcaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    name: string;
    code: string;
    suggestedSalePrice: string;
  } | null;
  onConfirm: (salePrice: string) => void;
};

export default function AddToShowcaseDialog({
  open,
  onOpenChange,
  product,
  onConfirm,
}: AddToShowcaseDialogProps) {
  const [salePrice, setSalePrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize price when product changes
  useEffect(() => {
    if (product) {
      setSalePrice(product.suggestedSalePrice);
      setError(null);
    }
  }, [product]);

  const handleConfirm = () => {
    // Validate price
    const price = parseFloat(salePrice);
    
    if (isNaN(price) || price <= 0) {
      setError('Please enter a valid price greater than 0');
      return;
    }

    if (price > 999999) {
      setError('Price cannot exceed $999,999');
      return;
    }

    onConfirm(price.toFixed(2));
    onOpenChange(false);
  };

  const handleCancel = () => {
    setError(null);
    onOpenChange(false);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Showcase</DialogTitle>
          <DialogDescription>
            Set the sale price for this product in your showcase
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Info */}
          <div className="space-y-1">
            <p className="font-medium text-sm">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.code}</p>
          </div>

          {/* Suggested Price Info */}
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">Suggested Sale Price</p>
            <p className="text-lg font-semibold">${product.suggestedSalePrice}</p>
          </div>

          {/* Sale Price Input */}
          <div className="space-y-2">
            <Label htmlFor="salePrice">Your Sale Price *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="salePrice"
                type="number"
                step="0.01"
                min="0.01"
                max="999999"
                value={salePrice}
                onChange={(e) => {
                  setSalePrice(e.target.value);
                  setError(null);
                }}
                className="pl-9"
                placeholder="0.00"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirm();
                  }
                }}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              You can adjust the price based on market conditions
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Add to Showcase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
