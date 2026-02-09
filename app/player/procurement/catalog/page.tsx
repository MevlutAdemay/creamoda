import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { ManufacturingGroup } from '@prisma/client';
import type { CatalogProduct, CatalogGroup } from './_lib/types';
import { CatalogView } from './_components/CatalogView';

const GROUP_LABELS: Record<string, string> = {
  ALL: 'All',
  JERSEY: 'Jersey',
  WOVEN: 'Woven',
  DENIM: 'Denim',
  KNITWEAR: 'Knitwear',
  OUTERWEAR: 'Outerwear',
  LEATHER: 'Leather',
  FOOTWEAR: 'Footwear',
  ACCESSORY: 'Accessory',
};

export default async function ProcurementCatalogPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const playerProducts = await prisma.playerProduct.findMany({
    where: { companyId: company.id },
    include: {
      productTemplate: {
        include: {
          categoryL3: true,
        },
      },
      images: {
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
        include: {
          productImageTemplate: { select: { url: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const products: CatalogProduct[] = playerProducts.map((pp) => {
    const template = pp.productTemplate;
    const categoryL3 = template.categoryL3;
    const group = categoryL3?.manufacturingGroup ?? null;
    const firstPlayerImage = pp.images[0];
    const imageUrl =
      firstPlayerImage?.urlOverride ??
      firstPlayerImage?.productImageTemplate?.url ??
      null;
    return {
      id: pp.id,
      code: pp.internalSkuCode ?? template.code,
      templateCode: template.code,
      name: pp.displayName ?? template.name,
      baseCost: Number(template.baseCost),
      shippingProfile: template.shippingProfile,
      manufacturingGroup: group,
      imageUrl,
    };
  });

  const groupCounts = new Map<string, number>();
  groupCounts.set('ALL', products.length);
  for (const p of products) {
    if (p.manufacturingGroup) {
      groupCounts.set(p.manufacturingGroup, (groupCounts.get(p.manufacturingGroup) ?? 0) + 1);
    }
  }

  const groupOrder: string[] = ['ALL', ...Object.values(ManufacturingGroup)];
  const groups: CatalogGroup[] = groupOrder
    .filter((value) => groupCounts.get(value) !== undefined && (value === 'ALL' || (groupCounts.get(value) ?? 0) > 0))
    .map((value) => ({
      value,
      label: GROUP_LABELS[value] ?? value,
      count: groupCounts.get(value) ?? 0,
    }));

  return (
    <div className="relative max-h-screen bg-transparent">
      <div className="container mx-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2">Procurement Catalog</h1>
            <p className="text-muted-foreground">
              Browse your product catalog by manufacturing group and add items to your plan.
            </p>
          </div>
          <CatalogView products={products} groups={groups} />
        </div>
      </div>
    </div>
  );
}
