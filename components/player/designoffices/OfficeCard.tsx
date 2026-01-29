'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatePresence, motion } from 'framer-motion';
import type { StyleTag, ProductQuality, ProductSeason } from '@prisma/client';

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
  return value === 'WINTER' ? 'Winter' : 'Summer';
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
  totalSkuCount: number;
  l1CategoryCounts: Array<{ l1Title: string; count: number }>;
};

type OfficeCardProps = {
  studio: OfficeCardStudio;
  onAdd?: (studio: OfficeCardStudio) => void;
};

export function OfficeCard({ studio, onAdd }: OfficeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Use shortPitch if available, otherwise generate description
  const description = studio.shortPitch || 
    `${humanizeStyleTag(studio.styleTag)} Giyim Tarzı için çok çeşit bulacağınız tasarım ofisini ziyaret ediniz.`;

  const topCategories = studio.l1CategoryCounts.slice(0, 5);
  const remainingCount = studio.l1CategoryCounts.length - 5;

  return (
    <article className="relative w-full overflow-hidden rounded-lg bg-muted shadow-md transition-shadow hover:shadow-lg">
      {/* Aspect ratio 1200:1800 = 2:3 */}
      <div className="relative aspect-2/3 w-full">
        {/* Background image - full size */}
        {studio.coverImageUrl ? (
          <Image
            src={studio.coverImageUrl}
            alt={studio.title}
            fill
            className="object-cover object-center"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-muted" />
        )}

        {/* Top bar: title (left) + button (right) */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3 z-10">
          <h3 className="text-md font-semibold text-gray-300 pb-2 bg-foreground/20 rounded-md line-clamp-2 p-2">
            {studio.title}
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Close' : 'Expand'}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`} />
          </Button>
        </div>

        {/* Bottom panel area - animated */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <AnimatePresence mode="wait">
            {!isExpanded ? (
              // Collapsed: Description strip
              <motion.div
                key="collapsed"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12, height: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="rounded-b-lg border border-white/10 bg-white/10 p-3 backdrop-blur-md dark:bg-black/20"
              >
                <p className="text-xs text-gray-300 leading-snug">
                  {description}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[12px] font-semibold uppercase tracking-wide text-secondary">
                  <span>{humanizeStyleTag(studio.styleTag)}</span>
                  <span aria-hidden>·</span>
                  <span>{humanizeQuality(studio.quality)}</span>
                </div>
              </motion.div>
            ) : (
              // Expanded: Preview panel
              <motion.div
                key="expanded"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="rounded-b-lg border border-white/10 bg-white/10 p-4 backdrop-blur-md dark:bg-black/40"
              >
                {/* Top row: StyleTag + Quality (left) | Total SKU + Season (right) */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-300">
                      {humanizeStyleTag(studio.styleTag)}
                    </div>
                    <div className="text-xs text-secondary">
                      {humanizeQuality(studio.quality)}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs font-medium text-gray-300">
                      Total SKU: {studio.totalSkuCount}
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      {humanizeSeason(studio.productSeason)}
                    </Badge>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10 mb-3" />

                {/* Category counts */}
                {topCategories.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {topCategories.map((cat) => (
                      <div
                        key={cat.l1Title}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-gray-300">{cat.l1Title}</span>
                        <span className="text-secondary dark:text-gray-300 font-medium">
                          {cat.count}
                        </span>
                      </div>
                    ))}
                    {remainingCount > 0 && (
                      <div className="text-[10px] text-muted-foreground dark:text-gray-300 pt-1">
                        +{remainingCount} more
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mb-3">
                    No categories available
                  </div>
                )}

                {/* Visit button */}
                <Link href={`/player/designoffices/${studio.code}`} className="block">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-9 text-xs font-medium"
                  >
                    Visit Studio
                  </Button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}
