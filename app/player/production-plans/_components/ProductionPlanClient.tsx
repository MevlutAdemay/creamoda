'use client';

import { ProductionPlanProductCard } from './ProductionPlanProductCard';

export type ProductionPlanProduct = {
  id: string;
  displayName: string | null;
  internalSkuCode: string | null;
  productTemplate: { name: string };
  coverImageUrl: string | null;
  planBadgeLabel: string;
  planBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  planSummaryLine1: string;
  planSummaryLine2?: string;
  href: string;
};

export type ProductionPlanClientProps = {
  products: ProductionPlanProduct[];
  seasonKey: string;
};

export function ProductionPlanClient({ products }: ProductionPlanClientProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
      {products.map((p) => (
        <ProductionPlanProductCard
          key={p.id}
          playerProduct={{
            id: p.id,
            displayName: p.displayName,
            internalSkuCode: p.internalSkuCode,
            productTemplate: p.productTemplate,
          }}
          coverImageUrl={p.coverImageUrl}
          planBadgeLabel={p.planBadgeLabel}
          planBadgeVariant={p.planBadgeVariant}
          planSummaryLine1={p.planSummaryLine1}
          planSummaryLine2={p.planSummaryLine2}
          href={p.href}
        />
      ))}
    </div>
  );
}
