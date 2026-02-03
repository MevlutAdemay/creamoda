// components/player/designoffices/OfficeCard.tsx

'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { StyleTag, ProductQuality, ProductSeason } from '@prisma/client';
import Image from 'next/image';

function humanizeStyleTag(value: StyleTag): string {
  const map: Record<StyleTag, string> = {
    CASUAL: 'CasualWear',
    STREET: 'Streetwear',
    SMART: 'Smart',
    BUSINESS: 'Business',
    ATHLEISURE: 'Athleisure',
  };
  return map[value] ?? value;
}

function humanizeQuality(value: ProductQuality): string {
  const map: Record<ProductQuality, string> = {
    STANDARD: 'Standard',
    PREMIUM: 'Premium',
    LUXURY: 'Luxury',
  };
  return map[value] ?? value;
}

function humanizeSeason(value: ProductSeason): string {
  const map: Record<ProductSeason, string> = {
    WINTER: 'Winter',
    SUMMER: 'Summer',
    ALL: 'All Seasons',
  };
  return map[value] ?? value;
}

/** Section label for productSeason/collections (e.g. "WINTER COLLECTIONS", "WOMEN COLLECTIONS") */
function collectionsLabel(productSeason: ProductSeason, audience?: string | null): string {
  if (audience) {
    const audienceUpper = audience.replace(/_/g, ' ');
    return `${audienceUpper} COLLECTIONS`;
  }
  if (productSeason === 'ALL') return 'ALL COLLECTIONS';
  return `${humanizeSeason(productSeason).toUpperCase()} COLLECTIONS`;
}

export type OfficeCardStudio = {
  id: string;
  code: string;
  title: string;
  coverImageUrl: string | null;
  shortPitch?: string | null;
  styleTag: StyleTag;
  quality: ProductQuality;
  productSeason: ProductSeason;
  studioType?: string;
  audience?: string | null;
  externalWebsiteUrl?: string | null;
  totalSkuCount: number;
  l1CategoryCounts: Array<{ l1Title: string; count: number }>;
};

type OfficeCardProps = {
  studio: OfficeCardStudio;
};

export function OfficeCard({ studio }: OfficeCardProps) {
  const description =
    studio.shortPitch ||
    `A ${humanizeStyleTag(studio.styleTag).toLowerCase()}-focused design studio offering a broad mix of everyday essentials. Clean silhouettes, versatile fits, and season-ready pieces designed for easy combination and high product variety.`;

  const studioTypeLabel = studio.studioType ?? 'VIRTUAL';
  const collectionsSectionLabel = collectionsLabel(studio.productSeason, studio.audience);

  return (
    <Card className="overflow-hidden relative h-100">
      <CardContent className="relative p-0 aspect-2/3">
        {/* Arka plan görseli: sağa dayalı, transparan alanlar üst üste binince kesilmez */}
        {studio.coverImageUrl && (
          <div className="absolute right-0 top-0 w-[50%] aspect-2/3 h-100">
            <Image
              src={studio.coverImageUrl}
              alt={`${studio.title} studio`}
              fill
              className="object-contain object-bottom-right"
              sizes="(max-width: 768px) 35vw, 300px"
            />
          </div>
        )}

        {/* Metin alanı: sol tarafta %65, üstte */}
        <div className="relative z-10 flex min-h-full max-w-[65%] flex-col p-6">
          <h6 className="text-md font-bold tracking-tight text-primary md:text-xl">
            {studio.title}
          </h6>
          <p className="mt-3 text-xs leading-relaxed text-foreground">
            {description}
          </p>

          <div className="mt-4 space-y-1">
            <p className="text-base font-medium text-foreground">
              {humanizeStyleTag(studio.styleTag)}
            </p>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              {humanizeQuality(studio.quality).toUpperCase()}
            </p>
          </div>

          <div className="mt-4 space-y-1">
            <p className="text-base font-medium text-foreground">
              {collectionsSectionLabel}
            </p>
            <p className="text-sm tracking-wide text-muted-foreground">
              Studio Type{' '}
              <span className="uppercase">{studioTypeLabel}</span>
            </p>
            {studio.studioType === 'REAL' && studio.externalWebsiteUrl && (
              <p className="text-sm mt-4">
                <a
                  href={studio.externalWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
                >
                  {studio.externalWebsiteUrl}
                </a>
              </p>
            )}
            <Button asChild variant="default" size="default">
              <Link href={`/player/designoffices/${studio.code}`}>
                Visit STUDIO
              </Link>
            </Button>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
