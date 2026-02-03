/**
 * GET /api/player/marketing-packages?scope=WAREHOUSE|CATEGORY|PRODUCT
 * Returns active packages for the scope, ordered by sortIndex asc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
const VALID_SCOPES = ['WAREHOUSE', 'CATEGORY', 'PRODUCT'] as const;
type ScopeParam = (typeof VALID_SCOPES)[number];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') as ScopeParam | null;
    if (!scope || !VALID_SCOPES.includes(scope)) {
      return NextResponse.json(
        { error: 'scope is required and must be WAREHOUSE, CATEGORY, or PRODUCT' },
        { status: 400 }
      );
    }

    const packages = await (prisma as any).marketingPackageDefinition.findMany({
      where: { scope, isActive: true },
      orderBy: { sortIndex: 'asc' },
      select: {
        id: true,
        scope: true,
        key: true,
        title: true,
        description: true,
        durationDays: true,
        positiveBoostPct: true,
        negativeBoostPct: true,
        priceUsd: true,
        awarenessGainDec: true,
        sortIndex: true,
      },
    });

    return NextResponse.json({
      packages: packages.map((p: { priceUsd: { toString: () => string }; awarenessGainDec?: unknown; [k: string]: unknown }) => ({
        ...p,
        priceUsd: p.priceUsd?.toString?.() ?? p.priceUsd,
        awarenessGainDec: p.awarenessGainDec?.toString?.() ?? p.awarenessGainDec ?? '0',
      })),
    });
  } catch (e) {
    console.error('[marketing-packages GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load packages' },
      { status: 500 }
    );
  }
}
