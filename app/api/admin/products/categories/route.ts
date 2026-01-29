//app/api/admin/products/categories/route.ts

/**
 * Product Categories API
 * GET: List categories with optional filters
 * POST: Create new category
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { CategoryLevel, Prisma } from '@prisma/client';

// Helper: Get next level
function getNextLevel(currentLevel: CategoryLevel): CategoryLevel | null {
  switch (currentLevel) {
    case CategoryLevel.L0: return CategoryLevel.L1;
    case CategoryLevel.L1: return CategoryLevel.L2;
    case CategoryLevel.L2: return CategoryLevel.L3;
    default: return null;
  }
}

// Helper: Validate parent level
function validateParentLevel(level: CategoryLevel, parentLevel: CategoryLevel | null): boolean {
  switch (level) {
    case CategoryLevel.L0: return parentLevel === null;
    case CategoryLevel.L1: return parentLevel === CategoryLevel.L0;
    case CategoryLevel.L2: return parentLevel === CategoryLevel.L1;
    case CategoryLevel.L3: return parentLevel === CategoryLevel.L2;
    default: return false;
  }
}

// Helper: Check for cycles (parentId cannot be self or descendant)
async function checkCycle(prisma: any, categoryId: string, parentId: string | null): Promise<boolean> {
  if (!parentId) return false;
  if (categoryId === parentId) return true;

  // Check if parentId is a descendant of categoryId
  let currentId = parentId;
  const visited = new Set<string>();
  
  while (currentId) {
    if (visited.has(currentId)) break; // Prevent infinite loop
    if (currentId === categoryId) return true;
    visited.add(currentId);
    
    const parent = await prisma.productCategoryNode.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    
    if (!parent || !parent.parentId) break;
    currentId = parent.parentId;
  }
  
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const tree = searchParams.get('tree') === '1';
    const levelParam = searchParams.get('level');
    const parentIdParam = searchParams.get('parentId');

    // Strict enum parsing for level
    const level = levelParam && Object.values(CategoryLevel).includes(levelParam as CategoryLevel)
      ? (levelParam as CategoryLevel)
      : null;

    // ParentId: string or null (not undefined)
    const parentId = parentIdParam || null;

    if (tree) {
      // Return nested tree structure
      const rootCategories = await prisma.productCategoryNode.findMany({
        where: { parentId: null },
        include: {
          defaultSizeProfile: {
            select: {
              id: true,
              name: true,
            },
          },
          children: {
            include: {
              defaultSizeProfile: {
                select: {
                  id: true,
                  name: true,
                },
              },
              children: {
                include: {
                  defaultSizeProfile: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  children: {
                    include: {
                      defaultSizeProfile: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                    orderBy: { code: 'asc' },
                  },
                },
                orderBy: { code: 'asc' },
              },
            },
            orderBy: { code: 'asc' },
          },
        },
        orderBy: { code: 'asc' },
      });

      return NextResponse.json(rootCategories);
    }

    // Flat list mode
    const where: Prisma.ProductCategoryNodeWhereInput = {
      isActive: true,
    };
    if (level) {
      where.level = level;
    }
    if (parentId !== null) {
      where.parentId = parentId;
    }

    const categories = await prisma.productCategoryNode.findMany({
      where,
      select: {
        id: true,
        level: true,
        code: true,
        name: true,
        slug: true,
        parentId: true,
      },
      orderBy: {
        code: 'asc',
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const {
      level,
      code,
      name,
      slug,
      parentId,
      manufacturingGroup,
      defaultShippingProfile,
      defaultSizeProfileId,
      isActive = true,
    } = body;

    // Validation
    if (!level || !code || !name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: level, code, name, slug' },
        { status: 400 }
      );
    }

    // Validate parent level
    const finalParentId = parentId === '__none__' ? null : (parentId || null);
    let parentLevel: CategoryLevel | null = null;
    
    if (finalParentId) {
      const parent = await prisma.productCategoryNode.findUnique({
        where: { id: finalParentId },
        select: { level: true },
      });
      
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent category not found' },
          { status: 404 }
        );
      }
      
      parentLevel = parent.level;
      const requiredParentLevel = getNextLevel(level);
      if (!validateParentLevel(level, parentLevel)) {
        return NextResponse.json(
          { error: `Invalid parent level. ${level} must have a parent of level ${requiredParentLevel || 'L2'}` },
          { status: 400 }
        );
      }
    } else {
      // L0 must have null parent
      if (level !== CategoryLevel.L0) {
        return NextResponse.json(
          { error: 'Only L0 categories can have null parent' },
          { status: 400 }
        );
      }
    }

    // L3-only fields validation
    if (level !== CategoryLevel.L3) {
      if (manufacturingGroup || defaultShippingProfile || defaultSizeProfileId) {
        return NextResponse.json(
          { error: 'L3-only fields can only be set for L3 categories' },
          { status: 400 }
        );
      }
    }

    const category = await prisma.productCategoryNode.create({
      data: {
        level,
        code,
        name,
        slug,
        parentId: finalParentId,
        manufacturingGroup: level === CategoryLevel.L3 ? (manufacturingGroup === '__none__' ? null : manufacturingGroup) || null : null,
        defaultShippingProfile: level === CategoryLevel.L3 ? (defaultShippingProfile === '__none__' ? null : defaultShippingProfile) || null : null,
        defaultSizeProfileId: level === CategoryLevel.L3 ? (defaultSizeProfileId === '__none__' ? null : defaultSizeProfileId) || null : null,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
          },
        },
        defaultSizeProfile: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Category with this code or slug already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create category', details: error.message },
      { status: 500 }
    );
  }
}
