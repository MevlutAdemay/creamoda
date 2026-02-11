// app/player/production-plans/page.tsx – Production Plan by collectionKey (season param)

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';
import type { ProcurementMode, ProductionLineStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { ProductionPlanClient } from './_components/ProductionPlanClient';

type PageProps = {
  searchParams: Promise<{ season?: string }> | { season?: string };
};

type PlanLine = {
  procurementMode: ProcurementMode;
  status: ProductionLineStatus;
  plannedTotalQty: number | null;
  wholesaleQty: number;
  factoryQty: number;
  needByDate: Date | null;
};

function getPlanBadge(
  line: { procurementMode: ProcurementMode; status: ProductionLineStatus } | null
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!line || (line.procurementMode === 'UNDECIDED' && line.status === 'OPEN')) {
    return { label: 'Not planned', variant: 'secondary' };
  }
  if (line.status === 'RECEIVED') return { label: 'Received', variant: 'default' };
  if (line.status === 'ORDERED') return { label: 'Ordered', variant: 'default' };
  if (line.procurementMode === 'MIXED') return { label: 'Mixed', variant: 'outline' };
  if (line.procurementMode === 'FACTORY') return { label: 'Factory', variant: 'default' };
  if (line.procurementMode === 'WHOLESALE') return { label: 'Wholesale', variant: 'outline' };
  return { label: 'Not planned', variant: 'secondary' };
}

function getPlanSummaryLine1(line: PlanLine | null): string {
  const badge = getPlanBadge(line);
  return `Plan: ${badge.label}`;
}

function getPlanSummaryLine2(line: PlanLine | null): string | undefined {
  if (!line) return '—';
  const hasQty = (line.wholesaleQty ?? 0) > 0 || (line.factoryQty ?? 0) > 0;
  const qtyStr = hasQty ? `W: ${line.wholesaleQty}  F: ${line.factoryQty}` : '—';
  const needByStr =
    line.needByDate &&
    `Need by: ${line.needByDate.toISOString().slice(0, 10)}`;
  const parts = [qtyStr, needByStr].filter(Boolean);
  return parts.length > 1 ? parts.join('  ·  ') : parts[0] ?? '—';
}

function getSortOrder(
  line: { procurementMode: ProcurementMode; status: ProductionLineStatus } | null
): number {
  if (!line || (line.procurementMode === 'UNDECIDED' && line.status === 'OPEN')) return 0;
  if (line.procurementMode === 'FACTORY' || line.procurementMode === 'MIXED') return 1;
  return 2; // WHOLESALE, ORDERED, RECEIVED
}

export default async function ProductionPlansPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  if (session.user.role === 'SUPER_ADMIN' || session.user.role === 'CONTENT_MANAGER') {
    redirect('/admin/dashboard');
  }

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!company) redirect('/wizard');

  const firstWarehouse = await prisma.companyBuilding.findFirst({
    where: { companyId: company.id, role: BuildingRole.WAREHOUSE },
    select: { country: { select: { hemisphere: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const hemisphere = firstWarehouse?.country?.hemisphere === 'SOUTH' ? 'SOUTH' : 'NORTH';
  const keyField = hemisphere === 'NORTH' ? 'northCollectionKey' : 'southCollectionKey';

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const seasonParam = params.season?.trim() ?? '';

  if (!seasonParam) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Please open Production Plan from the home page by choosing a collection.
            </p>
            <div className="mt-4 flex justify-center">
              <Button asChild variant="outline" size="sm">
                <Link href="/player">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [playerProducts, productionPlan] = await Promise.all([
    prisma.playerProduct.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        isUnlocked: true,
        ...(keyField === 'northCollectionKey'
          ? { northCollectionKey: seasonParam }
          : { southCollectionKey: seasonParam }),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        productTemplate: { select: { name: true } },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          include: { productImageTemplate: { select: { url: true } } },
        },
      },
    }),
    prisma.productionPlan.findUnique({
      where: { companyId_collectionKey: { companyId: company.id, collectionKey: seasonParam } },
      include: {
        lines: {
          select: {
            playerProductId: true,
            procurementMode: true,
            status: true,
            plannedTotalQty: true,
            wholesaleQty: true,
            factoryQty: true,
            needByDate: true,
          },
        },
      },
    }),
  ]);

  const planLineMap = new Map<string, PlanLine>();
  if (productionPlan?.lines) {
    for (const l of productionPlan.lines) {
      planLineMap.set(l.playerProductId, {
        procurementMode: l.procurementMode,
        status: l.status,
        plannedTotalQty: l.plannedTotalQty,
        wholesaleQty: l.wholesaleQty,
        factoryQty: l.factoryQty,
        needByDate: l.needByDate,
      });
    }
  }

  const coverImageUrl = (
    images: { urlOverride: string | null; productImageTemplate: { url: string } }[]
  ): string | null => {
    const first = images[0];
    return first ? first.urlOverride ?? first.productImageTemplate.url : null;
  };

  const productsWithPlan = playerProducts.map((pp) => {
    const line = planLineMap.get(pp.id) ?? null;
    const badge = getPlanBadge(line);
    const name = pp.displayName?.trim() || pp.productTemplate.name;
    return {
      id: pp.id,
      displayName: pp.displayName,
      internalSkuCode: pp.internalSkuCode,
      productTemplate: { name: pp.productTemplate.name },
      coverImageUrl: coverImageUrl(pp.images),
      planBadgeLabel: badge.label,
      planBadgeVariant: badge.variant,
      planSummaryLine1: getPlanSummaryLine1(line),
      planSummaryLine2: getPlanSummaryLine2(line),
      sortOrder: getSortOrder(line),
      productName: name,
    };
  });

  productsWithPlan.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.productName.localeCompare(b.productName);
  });

  const products = productsWithPlan.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    internalSkuCode: p.internalSkuCode,
    productTemplate: p.productTemplate,
    coverImageUrl: p.coverImageUrl,
    planBadgeLabel: p.planBadgeLabel,
    planBadgeVariant: p.planBadgeVariant,
    planSummaryLine1: p.planSummaryLine1,
    planSummaryLine2: p.planSummaryLine2,
    href: `/player/production-plans/${p.id}?season=${encodeURIComponent(seasonParam)}`,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Package className="h-6 w-5 text-muted-foreground" />
          Production Plan
        </h1>
        <p className="text-sm text-muted-foreground">
          Collection: <span className="font-medium">{seasonParam}</span>
        </p>
      </div>

      {playerProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              No products in this collection yet. Add products from the collection first.
            </p>
            <div className="mt-4 flex justify-center">
              <Button asChild variant="outline" size="sm">
                <Link href="/player">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ProductionPlanClient products={products} seasonKey={seasonParam} />
      )}
    </div>
  );
}
