// app/player/collections/_components/DesignStudioCard.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

export type DesignStudioCardProps = {
  id: string;
  title: string;
  styleTag: string;
  season: string;
  coverImageUrl: string | null;
  quality: string;
  studioType: string;
};

export function DesignStudioCard({
  id,
  title,
  styleTag,
  season,
  coverImageUrl,
  quality,
  studioType,
}: DesignStudioCardProps) {
  
  const href = `/player/collections/${id}?season=${encodeURIComponent(season)}`;

  return (
    <Card className="border-primary/20 overflow-hidden w-full flex flex-col h-auto">
      {/* HEADER */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm sm:text-sm md:text-base leading-tight line-clamp-1">{title}</CardTitle>
          <Badge variant="secondary" className="font-normal shrink-0 text-[10px]">
            {styleTag}
          </Badge>
        </div>
      </CardHeader>

      {/* IMAGE */}
      <div className="relative w-full aspect-2/3 bg-muted/10">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={`${title} studio`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-contain object-center"
            priority={false}
          />
        ) : null}
      </div>

      {/* BODY */}
      <CardContent className="pt-4 flex-1 flex flex-col gap-3">
        <div className="mt-auto space-y-1 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Studio type:</span> {studioType}
          </div>
          <Badge variant="secondary" className="font-normal text-xs">
            {quality}
          </Badge>
        </div>
      </CardContent>

      {/* FOOTER / CTA */}
      <CardFooter className="pt-0">
        <Button asChild className="w-full">
          <Link href={href}>
            <Package className="h-4 w-4 mr-2" />
            View Products
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
