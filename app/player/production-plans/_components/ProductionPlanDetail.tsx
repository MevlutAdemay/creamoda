'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export type ProductionPlanDetailProps = {
  productName: string;
};

export function ProductionPlanDetail({ productName }: ProductionPlanDetailProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <h3 className="text-lg font-semibold">{productName}</h3>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </CardContent>
    </Card>
  );
}
