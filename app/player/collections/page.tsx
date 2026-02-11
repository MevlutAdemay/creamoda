// app/player/collections/page.tsx – Collections: DesignStudios, filter by season + styleTag group

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { ProductSeason, StyleTag } from '@prisma/client';
import type { CollectionsGroup } from './_lib/types';
import { CollectionsView } from './_components/CollectionsView';

const DEFAULT_SEASON: ProductSeason = 'WINTER';

const STYLE_TAG_LABELS: Record<string, string> = {
  ALL: 'ALL',
  CASUAL: 'Casual',
  STREET: 'Street',
  SMART: 'Smart',
  BUSINESS: 'Business',
  ATHLEISURE: 'Athleisure',
};

const STYLE_TAG_ORDER: string[] = ['ALL', ...Object.values(StyleTag)];

type PageProps = {
  searchParams: Promise<{ season?: string }> | { season?: string };
};

function parseSeason(value: string | undefined): ProductSeason {
  if (!value) return DEFAULT_SEASON;
  const upper = value.toUpperCase();
  if (upper === 'WINTER' || upper === 'SUMMER') return upper as ProductSeason;
  return DEFAULT_SEASON;
}

export default async function CollectionsPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const season = parseSeason(params.season);

  const studios = await prisma.designStudio.findMany({
    where: {},
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      styleTag: true,
      coverImageUrl: true,
      quality: true,
      studioType: true,
    },
  });

  const groupCounts = new Map<string, number>();
  groupCounts.set('ALL', studios.length);
  for (const s of studios) {
    groupCounts.set(s.styleTag, (groupCounts.get(s.styleTag) ?? 0) + 1);
  }

  const groups: CollectionsGroup[] = STYLE_TAG_ORDER.filter(
    (value) => value === 'ALL' || (groupCounts.get(value) ?? 0) > 0
  ).map((value) => ({
    value,
    label: STYLE_TAG_LABELS[value] ?? value,
    count: groupCounts.get(value) ?? 0,
  }));

  return (
    <div className="min-h-full">
      <div className="container mx-auto px-4 py-8 min-w-full">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h1 className="text-2xl font-semibold">Design Studios</h1>
          <p className="text-sm text-muted-foreground">
            Season: <span className="font-medium capitalize">{season.toLowerCase()}</span>
          </p>
        </div>

        {studios.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz tasarım stüdyosu yok.</p>
        ) : (
          <CollectionsView studios={studios} groups={groups} season={season} />
        )}
      </div>
    </div>
  );
}
