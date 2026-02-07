// app/player/designoffices/page.tsx

import { StyleTag, ProductQuality, ProductSeason } from '@prisma/client';
import prisma from '@/lib/prisma';
import { DesignOfficesFilters } from '@/components/player/designoffices/design-offices-filters';
import { OfficeCard } from '@/components/player/designoffices/OfficeCard';

type PageProps = {
  searchParams: Promise<{
    styleTag?: string;
    quality?: string;
  }> | {
    styleTag?: string;
    quality?: string;
  };
};

// Helper to validate enum values
function isValidStyleTag(value: string): value is StyleTag {
  return Object.values(StyleTag).includes(value as StyleTag);
}

function isValidProductQuality(value: string): value is ProductQuality {
  return Object.values(ProductQuality).includes(value as ProductQuality);
}

export default async function DesignOfficesPage({ searchParams }: PageProps) {
  // Handle both Promise and direct searchParams (Next.js version compatibility)
  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  
  // Extract and validate filter params
  const styleTagParam = params.styleTag;
  const qualityParam = params.quality;

  const selectedStyleTag = styleTagParam && isValidStyleTag(styleTagParam) 
    ? styleTagParam 
    : 'ALL';
  
  const selectedQuality = qualityParam && isValidProductQuality(qualityParam)
    ? qualityParam
    : 'ALL';

  // Build Prisma where clause
  const where: {
    styleTag?: StyleTag;
    quality?: ProductQuality;
  } = {};

  if (selectedStyleTag !== 'ALL') {
    where.styleTag = selectedStyleTag;
  }

  if (selectedQuality !== 'ALL') {
    where.quality = selectedQuality;
  }

  // Fetch studios with filters and aggregations
  const studiosRaw = await prisma.designStudio.findMany({
    where,
    include: {
      items: {
        include: {
          productTemplate: {
            include: {
              categoryL3: {
                include: {
                  parent: {
                    include: {
                      parent: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { title: 'asc' },
    ],
  });

  // Helper: Walk up category tree to find L1 node
  function getL1Category(category: {
    level: string;
    name: string;
    parent: {
      level: string;
      name: string;
      parent: { level: string; name: string } | null;
    } | null;
  }): string {
    if (category.level === 'L1') {
      return category.name;
    }
    if (category.parent?.level === 'L1') {
      return category.parent.name;
    }
    if (category.parent?.parent?.level === 'L1') {
      return category.parent.parent.name;
    }
    // Fallback if structure is unexpected
    return category.name;
  }

  // Process studios with aggregations
  const studios = studiosRaw.map((studio) => {
    const totalSkuCount = studio.items.length;

    // Group items by L1 category
    const categoryMap = new Map<string, number>();
    studio.items.forEach((item) => {
      if (item.productTemplate?.categoryL3) {
        const l1Name = getL1Category(item.productTemplate.categoryL3);
        categoryMap.set(l1Name, (categoryMap.get(l1Name) || 0) + 1);
      }
    });

    // Convert to array and sort
    const l1CategoryCounts = Array.from(categoryMap.entries())
      .map(([l1Title, count]) => ({ l1Title, count }))
      .sort((a, b) => {
        // Sort by count desc, then title asc
        if (b.count !== a.count) return b.count - a.count;
        return a.l1Title.localeCompare(b.l1Title);
      });

    return {
      id: studio.id,
      code: studio.code,
      title: studio.title,
      coverImageUrl: studio.coverImageUrl,
      shortPitch: studio.shortPitch ?? null,
      styleTag: studio.styleTag,
      quality: studio.quality,
      productSeason: studio.productSeason,
      studioType: studio.studioType,
      audience: studio.audience ?? null,
      externalWebsiteUrl: studio.externalWebsiteUrl ?? null,
      totalSkuCount,
      l1CategoryCounts,
    };
  });

  return (
    <div className="relative min-h-[80vh] bg-transparent w-full">
      <div className="container mx-auto p-4 min-w-full">
        {/* Header */}
        <div className="mb-8">
          <h6 className="text-xl font-bold mb-4">Product Pool</h6>
          <p className="text-xs text-muted-foreground">
            Manage your product pool from design studios.
          </p>
        </div>

        {/* Filter Bar */}
        <DesignOfficesFilters
          selectedStyleTag={selectedStyleTag}
          selectedQuality={selectedQuality}
        />

        {/* Studios Grid */}
        {studios.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No design studios found matching your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-w-full max-w-6xl">
            {studios.map((studio) => (
              <OfficeCard
                key={studio.id}
                studio={{
                  id: studio.id,
                  code: studio.code,
                  title: studio.title,
                  coverImageUrl: studio.coverImageUrl,
                  shortPitch: studio.shortPitch,
                  styleTag: studio.styleTag,
                  quality: studio.quality,
                  productSeason: studio.productSeason,
                  studioType: studio.studioType,
                  audience: studio.audience,
                  externalWebsiteUrl: studio.externalWebsiteUrl,
                  totalSkuCount: studio.totalSkuCount,
                  l1CategoryCounts: studio.l1CategoryCounts,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
