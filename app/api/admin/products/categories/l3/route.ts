//app/api/admin/products/categories/l3/route.ts

/**
 * L3 Categories API for Template Picker
 * Returns only L3 categories with parent chain labels
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { CategoryLevel } from '@prisma/client';

type L3CategoryResponse = {
  id: string;
  code: string;
  name: string;
  slug: string;
  parentId: string | null;
  pathLabel: string;
};

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    // Fetch L3 categories with full parent chain
    const l3Categories = await prisma.productCategoryNode.findMany({
      where: {
        level: CategoryLevel.L3,
        isActive: true,
      },
      include: {
        parent: {
          include: {
            parent: {
              include: {
                parent: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    level: true,
                  },
                },
              },
              select: {
                id: true,
                code: true,
                name: true,
                level: true,
              },
            },
          },
          select: {
            id: true,
            code: true,
            name: true,
            level: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    // Build response with path labels
    const response: L3CategoryResponse[] = l3Categories.map((cat) => {
      const path: string[] = [];
      
      // Build path from L0 -> L1 -> L2 -> L3
      if (cat.parent?.parent?.parent) {
        path.push(cat.parent.parent.parent.name);
      }
      if (cat.parent?.parent) {
        path.push(cat.parent.parent.name);
      }
      if (cat.parent) {
        path.push(cat.parent.name);
      }
      path.push(cat.name);

      const pathLabel = path.join(' > ');

      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId,
        pathLabel,
      };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching L3 categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch L3 categories' },
      { status: 500 }
    );
  }
}
