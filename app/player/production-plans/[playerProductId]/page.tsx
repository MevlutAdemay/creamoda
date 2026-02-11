// app/player/production-plans/[playerProductId]/page.tsx – Product detail skeleton

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Palette, Ruler, Star, Tag } from 'lucide-react';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';

type PageProps = {
  params: Promise<{ playerProductId: string }>;
  searchParams: Promise<{ season?: string }> | { season?: string };
};

export default async function ProductionPlanDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { playerProductId } = await params;
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const playerProduct = await prisma.playerProduct.findUnique({
    where: {
      id: playerProductId,
      companyId: company.id,
    },
    include: {
      productTemplate: { select: { name: true, code: true } },
      images: {
        orderBy: { sortOrder: 'asc' },
        take: 1,
        include: { productImageTemplate: { select: { url: true } } },
      },
    },
  });

  if (!playerProduct) notFound();

  const paramsResolved = searchParams instanceof Promise ? await searchParams : searchParams;
  const seasonParam = paramsResolved.season?.trim() ?? '';
  const backHref = seasonParam
    ? `/player/production-plans?season=${encodeURIComponent(seasonParam)}`
    : '/player/production-plans';

  const name = playerProduct.displayName?.trim() || playerProduct.productTemplate.name;
  const refCode = playerProduct.internalSkuCode?.trim() || playerProduct.productTemplate.code;
  const coverImageUrl = playerProduct.images[0]
    ? playerProduct.images[0].urlOverride ?? playerProduct.images[0].productImageTemplate.url
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
          <Link href={backHref} className="inline-flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back to Plan
          </Link>
        </Button>
      </div>

      <div className="relative rounded-3xl bg-card overflow-hidden shadow-xl max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row gap-6 p-6">
          {/* Left: product info */}
          <div className="flex-1 space-y-4 min-w-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold">{name}</h1>
              <p className="text-sm text-muted-foreground mt-1">Ref. {refCode}</p>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Production plan details will appear here.</p>
            </div>

            {/* Tabs skeleton */}
            <div className="pt-4 border-t">
              <Tabs defaultValue="variants" className="w-full">
                <TabsList className="mb-4 flex flex-wrap gap-1">
                  <TabsTrigger value="variants" className="flex items-center gap-1">
                    <Palette className="h-4 w-4" />
                    <span className="hidden sm:inline">Variants</span>
                  </TabsTrigger>
                  <TabsTrigger value="technical-report" className="flex items-center gap-1">
                    <Ruler className="h-4 w-4" />
                    <span className="hidden sm:inline">Technical Report</span>
                  </TabsTrigger>
                  <TabsTrigger value="season-scores" className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    <span className="hidden sm:inline">Season Scores</span>
                  </TabsTrigger>
                  <TabsTrigger value="suggested" className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    <span className="hidden sm:inline">Suggested</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="variants">
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-sm text-muted-foreground text-center">Coming soon.</p>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="technical-report">
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-sm text-muted-foreground text-center">No data yet.</p>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="season-scores">
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-sm text-muted-foreground text-center">Coming soon.</p>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="suggested">
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-sm text-muted-foreground text-center">No data yet.</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right: image area */}
          <div className="md:w-80 shrink-0">
            <div className="relative aspect-2/3 rounded-lg overflow-hidden bg-muted">
              {coverImageUrl ? (
                <Image
                  src={coverImageUrl}
                  alt={name}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">No image</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
