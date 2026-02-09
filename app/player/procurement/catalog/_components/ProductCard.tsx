'use client';

import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastCenter';
import type { CatalogProduct } from '../_lib/types';

type ProductCardProps = {
  product: CatalogProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  const toast = useToast();
  const groupLabel = product.manufacturingGroup ?? '—';

  function handleAddToPlan() {
    toast({ title: 'Plan coming soon', message: 'Procurement plan is not available yet.', kind: 'info' });
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="p-0">
        <div className="relative aspect-4/5 w-full bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-semibold text-foreground line-clamp-2">{product.name}</h3>
        <p className="text-xs text-muted-foreground font-mono">{product.code}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">${product.baseCost.toFixed(2)}</span>
          <Badge variant="outline" className="text-xs">
            {product.shippingProfile}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {groupLabel}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          onClick={handleAddToPlan}
        >
          Add to Plan
        </Button>
      </CardFooter>
    </Card>
  );
}
