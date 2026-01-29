// app/api/admin/wholesales/marketzones/route.ts

import { NextResponse } from 'next/server';
import { MarketZone } from '@prisma/client';

export async function GET() {
  try {
    // Return all MarketZone enum values
    const marketZones = Object.values(MarketZone);
    return NextResponse.json(marketZones);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch market zones';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
