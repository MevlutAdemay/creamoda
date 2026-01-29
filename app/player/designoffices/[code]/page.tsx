// app/player/designoffices/[code]/page.tsx

import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import ProductCard from '@/components/ui/ProductCard';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from '@/components/player/designoffices/VerifiedBadge';
import { OfficialWebsiteLink } from '@/components/player/designoffices/OfficialWebsiteLink';
import { getServerSession } from '@/lib/auth/get-session';
import { BuildingRole } from '@prisma/client';
import type { StyleTag, ProductQuality, ProductSeason } from '@prisma/client';

type PageProps = {
  params: Promise<{ code: string }>;
};

// Helper functions for humanizing enum values
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

function humanizeAudience(value: string | null): string {
  if (!value) return '';
  const map: Record<string, string> = {
    MEN: 'Men',
    WOMEN: 'Women',
    UNISEX: 'Unisex',
    KIDS: 'Kids',
  };
  return map[value] ?? value;
}

function humanizeStudioType(value: string): string {
  const map: Record<string, string> = {
    VIRTUAL: 'Virtual',
    PHYSICAL: 'Physical',
    HYBRID: 'Hybrid',
  };
  return map[value] ?? value;
}

// Warehouse info for pricing
type WarehouseInfo = {
  country: {
    id: string;
    name: string;
    iso2: string;
    priceMultiplier: number;
  } | null;
};

// Product type matching ProductCard expectations
type Product = {
  id: string;
  code?: string;
  name: string;
  title: string;
  price?: number;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  unlockCostXp?: number | null;
  unlockCostDiamond?: number | null;
  baseCost?: number | null;
  suggestedSalePrice?: number | null;
  warehouses?: WarehouseInfo[];
  isInCollection?: boolean;
  isUnlocked?: boolean;
};

export default async function DesignStudioDetailPage({ params }: PageProps) {
  const { code } = await params;

  // Get current player session, wallet balances, and company (for collection + warehouses)
  const session = await getServerSession();
  let playerXp = 0;
  let playerDiamonds = 0;
  let companyId: string | null = null;

  if (session?.user?.id) {
    const [player, company] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          wallet: {
            select: {
              balanceXp: true,
              balanceDiamond: true,
            },
          },
        },
      }),
      prisma.company.findFirst({
        where: { playerId: session.user.id },
        select: { id: true },
      }),
    ]);

    if (player?.wallet) {
      playerXp = player.wallet.balanceXp;
      playerDiamonds = player.wallet.balanceDiamond;
    }
    if (company) {
      companyId = company.id;
    }
  }

  // Fetch studio with items and product templates including images and unlock costs
  const studio = await prisma.designStudio.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      shortPitch: true,
      productSeason: true,
      styleTag: true,
      quality: true,
      audience: true,
      studioType: true,
      externalWebsiteUrl: true,
      items: {
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
        include: {
          productTemplate: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              baseCost: true,
              suggestedSalePrice: true,
              unlockCostXp: true,
              unlockCostDiamond: true,
              productImageTemplates: {
                orderBy: [
                  { sortOrder: 'asc' },
                  { createdAt: 'asc' },
                ],
                select: {
                  url: true,
                  alt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!studio) {
    notFound();
  }

  // One query: PlayerProduct for this company and all product templates in this studio
  const productTemplateIds = studio.items.map((item) => item.productTemplate.id);
  const inCollectionMap = new Map<string, { isUnlocked: boolean }>();
  if (companyId && productTemplateIds.length > 0) {
    const playerProducts = await prisma.playerProduct.findMany({
      where: {
        companyId,
        productTemplateId: { in: productTemplateIds },
      },
      select: { productTemplateId: true, isUnlocked: true },
    });
    for (const pp of playerProducts) {
      inCollectionMap.set(pp.productTemplateId, { isUnlocked: pp.isUnlocked });
    }
  }

  // Fetch warehouses for pricing (reuse companyId)
  let warehouses: WarehouseInfo[] = [];
  if (companyId) {
    const warehouseBuildings = await prisma.companyBuilding.findMany({
        where: {
          companyId,
          role: BuildingRole.WAREHOUSE,
        },
        include: {
          country: {
            select: {
              id: true,
              name: true,
              iso2: true,
              priceMultiplier: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      warehouses = warehouseBuildings.map((wb) => {
        const country = wb.country;
        return {
          country: country
            ? {
                id: country.id,
                name: country.name,
                iso2: country.iso2,
                priceMultiplier: Number(country.priceMultiplier),
              }
            : null,
        };
      });
  }

  // Map DesignStudioItem.productTemplate to Product format (with collection state)
  const products: Product[] = studio.items.map((item) => {
    const template = item.productTemplate;
    const images = template.productImageTemplates.map((img) => img.url);
    const inCollection = inCollectionMap.get(template.id);

    // Convert Decimal to number
    const baseCost = template.baseCost ? Number(template.baseCost) : null;
    const suggestedSalePrice = template.suggestedSalePrice ? Number(template.suggestedSalePrice) : null;

    return {
      id: template.id,
      code: template.code,
      name: template.name,
      title: template.name, // ProductCard uses both name and title
      price: suggestedSalePrice ?? undefined,
      description: template.description || undefined,
      imageUrls: images.length > 0 ? images : undefined,
      imageUrl: images.length === 1 ? images[0] : undefined,
      unlockCostXp: template.unlockCostXp ?? null,
      unlockCostDiamond: template.unlockCostDiamond ?? null,
      baseCost,
      suggestedSalePrice,
      warehouses,
      isInCollection: !!inCollection,
      isUnlocked: inCollection?.isUnlocked ?? false,
    };
  });

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container mx-auto p-8">
        {/* Studio Header */}
        <div className="mb-8">
          {/* Title with Verified Badge */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <h1 className="text-4xl font-bold">{studio.title}</h1>
            {studio.studioType === 'REAL' && <VerifiedBadge />}
          </div>
          
          {/* Official Website Link */}
          {studio.studioType === 'REAL' && studio.externalWebsiteUrl && (
            <OfficialWebsiteLink url={studio.externalWebsiteUrl} />
          )}
          
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4 mt-4">
            <Badge variant="secondary" className="text-xs">
              {humanizeStyleTag(studio.styleTag)}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {humanizeQuality(studio.quality)}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {humanizeSeason(studio.productSeason)}
            </Badge>
            {studio.audience && (
              <Badge variant="secondary" className="text-xs">
                {humanizeAudience(studio.audience)}
              </Badge>
            )}
          </div>

          {/* Description */}
          {(studio.shortPitch || studio.description) && (
            <p className="text-muted-foreground max-w-3xl">
              {studio.shortPitch || studio.description}
            </p>
          )}
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No products available in this studio yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                templateId={product.id}
                companyId={companyId ?? undefined}
                playerXp={playerXp}
                playerDiamonds={playerDiamonds}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
