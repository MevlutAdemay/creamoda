'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gem, Sparkles } from 'lucide-react';
import ProductImageCarousel from '@/components/ui/ProductImageCarousel';
import { AddToCollectionButton } from './AddToCollectionButton';

export type CollectionProductCardProps = {
  companyId: string;
  templateId: string;
  name: string;
  code: string;
  productQuality: string;
  productRarity: string;
  unlockCostXp: number;
  unlockCostDiamond: number;
  categoryL1Name: string | null;
  timing: string | null;
  images: string[];
  alreadyInCollection?: boolean;
};

export function CollectionProductCard({
  companyId,
  templateId,
  name,
  code,
  productQuality,
  productRarity,
  unlockCostXp,
  unlockCostDiamond,
  categoryL1Name,
  timing,
  images,
  alreadyInCollection = false,
}: CollectionProductCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden w-full max-w-xs">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{name}</CardTitle>
        <Badge variant="outline" className="hidden sm:block text-[10px]">{code}</Badge>
        
        
      </CardHeader>

      <CardContent className="px-0 py-0 flex-1">
        {images.length > 0 ? (
          <div className="relative w-full aspect-square">
            <ProductImageCarousel images={images} alt={name} />
          </div>
        ) : (
          <div className="w-full bg-muted flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Görsel yok</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-1 pt-2">
        <div className="flex flex-row flex-wrap items-center justify-between gap-1.5">
          <p className="text-xs text-muted-foreground">Product Quality:</p>
          <p className="text-xs text-muted-foreground">{productQuality}</p>
        </div>
          {productRarity !== 'STANDARD' && (
            <div className="flex flex-row flex-wrap items-center justify-between gap-1.5">
            <p className="text-xs text-muted-foreground">Product Rarity:</p>
            <p className="text-xs text-muted-foreground">{productRarity}</p>
            </div>
          )}
          {categoryL1Name && (
            <div className="flex flex-row flex-wrap items-center justify-between gap-1.5">
            <p className="text-xs text-muted-foreground">Category:</p>
            <p className="text-xs text-muted-foreground">{categoryL1Name}</p>
            </div>
          )}  

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="text-xs text-muted-foreground">Unlock Cost:</p>
          {unlockCostXp === 0 && unlockCostDiamond === 0 ? (
            <span className="font-medium text-green-600">Free</span>
          ) : (
            <span className="flex items-center gap-2">
              {unlockCostXp > 0 && (
                <span className="flex items-center text-destructive gap-1">
                  <Sparkles className="h-3 w-3" />
                  {unlockCostXp} XP
                </span>
              )}
              {unlockCostDiamond > 0 && (
                <span className="flex items-center gap-1">
                  <Gem className="h-3 w-3" />
                  {unlockCostDiamond}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex flex-row items-center justify-between mt-2">
          <div className="flex">
            {timing && (
              <Badge variant="destructive" className="text-[10px]">
                {timing}
              </Badge>
            )}
          </div>
          <div>
          <AddToCollectionButton
            companyId={companyId}
            productTemplateId={templateId}
            disabled={alreadyInCollection}
            disabledLabel="On Your Collection"
          />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
