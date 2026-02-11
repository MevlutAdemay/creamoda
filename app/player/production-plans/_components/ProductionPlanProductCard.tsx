import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
export type ProductionPlanProductCardProps = {
  playerProduct: {
    id: string;
    displayName: string | null;
    internalSkuCode: string | null;
    productTemplate: { name: string };
  };
  coverImageUrl: string | null;
  planBadgeLabel: string;
  planBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  planSummaryLine1: string;
  planSummaryLine2?: string;
  href: string;
};

export function ProductionPlanProductCard({
  playerProduct,
  coverImageUrl,
  planBadgeLabel,
  planBadgeVariant,
  planSummaryLine1,
  planSummaryLine2,
  href,
}: ProductionPlanProductCardProps) {
  const name = playerProduct.displayName?.trim() || playerProduct.productTemplate.name;
  const sku = playerProduct.internalSkuCode?.trim() || null;

  return (
    <Link href={href} className="block w-full">
      <Card className="flex flex-col overflow-hidden w-full hover:bg-muted/50 transition-colors">
        <div className="relative w-full aspect-2/3 bg-muted">
          {coverImageUrl ? (
            <Image
              src={coverImageUrl}
              alt={name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 390px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}
          <Badge
            variant={planBadgeVariant}
            className="absolute top-2 right-2 shrink-0"
          >
            {planBadgeLabel}
          </Badge>
        </div>
        <CardHeader className="pb-2 pt-3 flex flex-row items-start justify-between gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
        {sku ? (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{sku}</span>
          ) : null}
          <p className="text-xs text-muted-foreground">{planSummaryLine1}</p>
          {planSummaryLine2 ? (
            <p className="text-xs text-muted-foreground">{planSummaryLine2}</p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
