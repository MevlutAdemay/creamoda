//app/api/admin/products/categories/picker/route.ts

/**
 * Category Picker API
 * Returns searchable L3 categories for picker dialog
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { CategoryLevel } from '@prisma/client';

type PickerCategoryResponse = {
  id: string;
  code: string;
  name: string;
  slug: string;
  manufacturingGroup: string | null;
  defaultShippingProfile: string | null;
  pathLabel: string;
};

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'L3';
    const query = searchParams.get('query') || '';

    // Build where clause
    const where: any = {
      level: CategoryLevel[level as keyof typeof CategoryLevel],
      isActive: true,
    };

    // Add search filter if query exists
    if (query) {
      where.OR = [
        { code: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Fetch L3 categories first (base query)
    const categories = await prisma.productCategoryNode.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        slug: true,
        manufacturingGroup: true,
        defaultShippingProfile: true,
        parentId: true,
      },
      orderBy: {
        code: 'asc',
      },
    });

    // Fetch all parent IDs
    const allParentIds = new Set<string>();
    categories.forEach((cat) => {
      if (cat.parentId) allParentIds.add(cat.parentId);
    });

    // Fetch all parents in one query
    const allParents = await prisma.productCategoryNode.findMany({
      where: {
        id: { in: Array.from(allParentIds) },
      },
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    });

    // Build parent map
    const parentMap = new Map(allParents.map((p) => [p.id, p]));

    // Fetch grandparents if needed
    const grandparentIds = new Set<string>();
    allParents.forEach((p) => {
      if (p.parentId) grandparentIds.add(p.parentId);
    });

    let grandparentMap = new Map<string, any>();
    if (grandparentIds.size > 0) {
      const grandparents = await prisma.productCategoryNode.findMany({
        where: {
          id: { in: Array.from(grandparentIds) },
        },
        select: {
          id: true,
          name: true,
          parentId: true,
        },
      });
      grandparentMap = new Map(grandparents.map((g) => [g.id, g]));
    }

    // Fetch great-grandparents if needed
    const greatGrandparentIds = new Set<string>();
    grandparentMap.forEach((gp) => {
      if (gp.parentId) greatGrandparentIds.add(gp.parentId);
    });

    let greatGrandparentMap = new Map<string, any>();
    if (greatGrandparentIds.size > 0) {
      const greatGrandparents = await prisma.productCategoryNode.findMany({
        where: {
          id: { in: Array.from(greatGrandparentIds) },
        },
        select: {
          id: true,
          name: true,
        },
      });
      greatGrandparentMap = new Map(greatGrandparents.map((gg) => [gg.id, gg]));
    }

    // Build response with path labels
    const response: PickerCategoryResponse[] = categories.map((cat) => {
      const path: string[] = [];

      // Build path from ancestors
      if (cat.parentId) {
        const parent = parentMap.get(cat.parentId);
        if (parent) {
          if (parent.parentId) {
            const grandparent = grandparentMap.get(parent.parentId);
            if (grandparent) {
              if (grandparent.parentId) {
                const greatGrandparent = greatGrandparentMap.get(grandparent.parentId);
                if (greatGrandparent) {
                  path.push(greatGrandparent.name);
                }
              }
              path.push(grandparent.name);
            }
          }
          path.push(parent.name);
        }
      }
      path.push(cat.name);

      const pathLabel = path.join(' > ');

      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        slug: cat.slug,
        manufacturingGroup: cat.manufacturingGroup,
        defaultShippingProfile: cat.defaultShippingProfile,
        pathLabel,
      };
    });

    return NextResponse.json(response);
  } catch (err) {
    const errorDetails: any = {
      error: 'Internal Server Error',
      details: err instanceof Error ? err.message : String(err),
    };

    if ((err as any)?.code) {
      errorDetails.prismaCode = (err as any).code;
    }

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
