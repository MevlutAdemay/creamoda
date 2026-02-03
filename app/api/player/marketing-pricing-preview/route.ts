/**
 * GET /api/player/marketing-pricing-preview?scope=...&warehouseBuildingId=...&categoryNodeId=...&listingId=...
 * Returns skuCount, multiplier, basePrice, totalPrice for UI preview.
 * - WAREHOUSE: warehouseBuildingId required
 * - CATEGORY: warehouseBuildingId + categoryNodeId required
 * - PRODUCT: listingId optional for display; basePrice = package price, totalPrice = basePrice (multiplier 1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import {
  getWarehouseSkuCount,
  getCategorySkuCount,
  getPricingMultiplier,
  computeTotalPrice,
} from '@/lib/marketing/campaign-cost';
const VALID_SCOPES = ['WAREHOUSE', 'CATEGORY', 'PRODUCT'] as const;
type ScopeParam = (typeof VALID_SCOPES)[number];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst({
      where: { playerId: session.user.id },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') as ScopeParam | null;
    const warehouseBuildingId = searchParams.get('warehouseBuildingId') ?? undefined;
    const categoryNodeId = searchParams.get('categoryNodeId') ?? undefined;
    const listingId = searchParams.get('listingId') ?? undefined;

    if (!scope || !VALID_SCOPES.includes(scope)) {
      return NextResponse.json(
        { error: 'scope is required and must be WAREHOUSE, CATEGORY, or PRODUCT' },
        { status: 400 }
      );
    }

    if (scope === 'WAREHOUSE' && !warehouseBuildingId) {
      return NextResponse.json(
        { error: 'warehouseBuildingId is required for WAREHOUSE scope' },
        { status: 400 }
      );
    }
    if (scope === 'CATEGORY' && (!warehouseBuildingId || !categoryNodeId)) {
      return NextResponse.json(
        { error: 'warehouseBuildingId and categoryNodeId are required for CATEGORY scope' },
        { status: 400 }
      );
    }

    let skuCount = 0;
    let multiplier = '1.000';
    let basePrice: string;
    let totalPrice: string;

    if (scope === 'WAREHOUSE' && warehouseBuildingId) {
      skuCount = await getWarehouseSkuCount(prisma, company.id, warehouseBuildingId);
      multiplier = await getPricingMultiplier(prisma, 'WAREHOUSE', skuCount);
      basePrice = '0'; // caller may pass packageId and we'd fetch price; for preview without package we return 0 or require packageId
      totalPrice = '0';
      // If client sends packageId we could fetch basePrice here; spec says "basePrice, totalPrice" - for preview without package show skuCount + multiplier only
      const pkgId = searchParams.get('packageId');
      if (pkgId) {
        const pkg = await (prisma as any).marketingPackageDefinition.findUnique({
          where: { id: pkgId, scope: 'WAREHOUSE', isActive: true },
          select: { priceUsd: true },
        });
        if (pkg) {
          basePrice = pkg.priceUsd?.toString?.() ?? String(pkg.priceUsd);
          const total = computeTotalPrice(pkg.priceUsd, multiplier);
          totalPrice = total.toString();
        }
      }
    } else if (scope === 'CATEGORY' && warehouseBuildingId && categoryNodeId) {
      skuCount = await getCategorySkuCount(prisma, company.id, warehouseBuildingId, categoryNodeId);
      multiplier = await getPricingMultiplier(prisma, 'CATEGORY', skuCount);
      basePrice = '0';
      totalPrice = '0';
      const pkgId = searchParams.get('packageId');
      if (pkgId) {
        const pkg = await (prisma as any).marketingPackageDefinition.findUnique({
          where: { id: pkgId, scope: 'CATEGORY', isActive: true },
          select: { priceUsd: true },
        });
        if (pkg) {
          basePrice = pkg.priceUsd?.toString?.() ?? String(pkg.priceUsd);
          const total = computeTotalPrice(pkg.priceUsd, multiplier);
          totalPrice = total.toString();
        }
      }
    } else {
      // PRODUCT: multiplier 1, total = basePrice (package price)
      skuCount = 1;
      multiplier = '1.000';
      basePrice = '0';
      totalPrice = '0';
      const pkgId = searchParams.get('packageId');
      if (pkgId) {
        const pkg = await (prisma as any).marketingPackageDefinition.findUnique({
          where: { id: pkgId, scope: 'PRODUCT', isActive: true },
          select: { priceUsd: true },
        });
        if (pkg) {
          basePrice = pkg.priceUsd?.toString?.() ?? String(pkg.priceUsd);
          totalPrice = basePrice;
        }
      }
    }

    return NextResponse.json({
      scope,
      skuCount,
      multiplier,
      basePrice,
      totalPrice,
    });
  } catch (e) {
    console.error('[marketing-pricing-preview GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to get preview' },
      { status: 500 }
    );
  }
}
