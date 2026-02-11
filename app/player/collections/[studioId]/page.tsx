// app/player/collections/[studioId]/page.tsx – Studio products filtered by season

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { ProductSeason } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { VerifiedBadge } from '@/components/player/designoffices/VerifiedBadge';
import { OfficialWebsiteLink } from '@/components/player/designoffices/OfficialWebsiteLink';
import { StudioProductsView, type CategoryGroup } from './_components/StudioProductsView';

const DEFAULT_SEASON: ProductSeason = 'WINTER';

type PageProps = {
  params: Promise<{ studioId: string }> | { studioId: string };
  searchParams: Promise<{ season?: string }> | { season?: string };
};

function parseSeason(value: string | undefined): ProductSeason {
  if (!value) return DEFAULT_SEASON;
  const upper = value.toUpperCase();
  if (upper === 'WINTER' || upper === 'SUMMER') return upper as ProductSeason;
  return DEFAULT_SEASON;
}

export default async function StudioCollectionsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const { studioId } = params instanceof Promise ? await params : params;
  const search = searchParams instanceof Promise ? await searchParams : searchParams;
  const season = parseSeason(search.season);

  const [studio, items] = await Promise.all([
    prisma.designStudio.findUnique({
      where: { id: studioId },
      select: {
        id: true,
        title: true,
        studioType: true,
        externalWebsiteUrl: true,
      },
    }),
    prisma.designStudioItem.findMany({
      where: {
        studioId,
        productTemplate: {
          productSeason: { in: [season, ProductSeason.ALL] },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      select: {
        productTemplate: {
          select: {
            id: true,
            code: true,
            name: true,
            productQuality: true,
            productRarity: true,
            unlockCostXp: true,
            unlockCostDiamond: true,
            categoryL3: {
              select: {
                parent: {
                  select: {
                    name: true,
                    parent: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
            seasonScenarioDefinition: {
              select: { timing: true },
            },
            productImageTemplates: {
              orderBy: { sortOrder: 'asc' },
              select: { url: true },
            },
          },
        },
      },
    }),
  ]);

  if (!studio) notFound();

  // Check which templates are already in the player's collection (one query)
  const templateIds = items.map((i) => i.productTemplate.id);
  const existingProducts = templateIds.length > 0
    ? await prisma.playerProduct.findMany({
        where: {
          companyId: company.id,
          productTemplateId: { in: templateIds },
          isUnlocked: true,
        },
        select: { productTemplateId: true },
      })
    : [];
  const inCollection = new Set(existingProducts.map((e) => e.productTemplateId));

  const collectionsHref = `/player/collections?season=${encodeURIComponent(season)}`;

  return (
    <div className="min-h-full">
      <div className="container mx-auto px-4 py-8 min-w-full">
        <div className="mb-0 space-y-4 p-4">
          <div className="flex flex-row items-center justify-baseline gap-2 mb-2">
            <Button variant="outline" size="sm" asChild className="-ml-2">
              <Link href={collectionsHref}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <Button asChild variant="default" size="sm">
              <Link href="/player">Complete Collection</Link>
            </Button>
          </div>
          <div className="flex flex-row items-baseline justify-between flex-wrap gap-1 mb-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl font-semibold">{studio.title}</h1>
              {studio.studioType === 'REAL' && <VerifiedBadge />}
            </div>
            {studio.studioType === 'REAL' && studio.externalWebsiteUrl && (
              <OfficialWebsiteLink url={studio.externalWebsiteUrl} />
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Sezon: <span className="font-medium capitalize">{season.toLowerCase()}</span>
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Bu sezona uygun ürün bulunamadı.
          </p>
        ) : (
          (() => {
            const products = items.map((item) => {
              const pt = item.productTemplate;
              const images = pt.productImageTemplates.map((img) => img.url);
              const categoryL1Name = pt.categoryL3?.parent?.parent?.name ?? null;
              return {
                companyId: company.id,
                templateId: pt.id,
                name: pt.name,
                code: pt.code,
                productQuality: pt.productQuality,
                productRarity: pt.productRarity,
                unlockCostXp: pt.unlockCostXp ?? 0,
                unlockCostDiamond: pt.unlockCostDiamond ?? 0,
                categoryL1Name,
                timing: pt.seasonScenarioDefinition?.timing ?? null,
                images,
                alreadyInCollection: inCollection.has(pt.id),
              };
            });

            const groupCounts = new Map<string, number>();
            groupCounts.set('ALL', products.length);
            for (const p of products) {
              const key = p.categoryL1Name ?? 'OTHER';
              groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
            }

            const uniqueL1 = [...new Set(products.map((p) => p.categoryL1Name ?? 'OTHER'))].sort();
            const groups: CategoryGroup[] = [
              { value: 'ALL', label: 'Tümü', count: products.length },
              ...uniqueL1
                .filter((v) => (groupCounts.get(v) ?? 0) > 0)
                .map((v) => ({ value: v, label: v, count: groupCounts.get(v) ?? 0 })),
            ];

            return <StudioProductsView products={products} groups={groups} />;
          })()
        )}
      </div>
    </div>
  );
}
