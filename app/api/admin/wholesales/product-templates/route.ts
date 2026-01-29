// app/api/admin/wholesales/product-templates/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth/get-session';
import type { Prisma } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'CONTENT_MANAGER')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: Prisma.ProductTemplateWhereInput = {
      isActive: true,
    };

    if (query) {
      where.OR = [
        { code: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.productTemplate.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        baseCost: true,
      },
      orderBy: { code: 'asc' },
      take: limit,
    });

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch product templates';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
