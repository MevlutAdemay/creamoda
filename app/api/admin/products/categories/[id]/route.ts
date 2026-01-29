/**
 * app/api/admin/products/categories/[id]/route.ts
 */

/**
 * Product Category API (single)
 * PATCH: Update category
 * DELETE: Delete category
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { CategoryLevel } from '@prisma/client';

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

// Helper: Check for cycles
async function checkCycle(prisma: any, categoryId: string, parentId: string | null): Promise<boolean> {
  if (!parentId) return false;
  if (categoryId === parentId) return true;

  let currentId = parentId;
  const visited = new Set<string>();
  
  while (currentId) {
    if (visited.has(currentId)) break;
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
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
    } = body;

    // Get current category
    const currentCategory = await prisma.productCategoryNode.findUnique({
      where: { id },
      select: {
        level: true,
        parentId: true,
      },
    });

    if (!currentCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const finalLevel = level !== undefined ? level : currentCategory.level;

    // Check if level change is allowed
    if (level !== undefined && level !== currentCategory.level) {
      // Check if category has children
      const childrenCount = await prisma.productCategoryNode.count({
        where: { parentId: id },
      });

      if (childrenCount > 0) {
        return NextResponse.json(
          { error: 'Cannot change level: category has children. Delete or move children first.' },
          { status: 409 }
        );
      }

      // Check if L3 category has templates
      if (currentCategory.level === CategoryLevel.L3) {
        const templatesCount = await prisma.productTemplate.count({
          where: { categoryL3Id: id },
        });

        if (templatesCount > 0) {
          return NextResponse.json(
            { error: 'Cannot change level: category has product templates attached.' },
            { status: 409 }
          );
        }
      }
    }

    // Validate parent if changed
    let parentLevel: CategoryLevel | null = null;
    const finalParentId = parentId !== undefined ? (parentId === '__none__' ? null : parentId) : currentCategory.parentId;

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
      const requiredParentLevel = getNextLevel(finalLevel);
      if (!validateParentLevel(finalLevel, parentLevel)) {
        return NextResponse.json(
          { error: `Invalid parent level. ${finalLevel} must have a parent of level ${requiredParentLevel || 'L2'}` },
          { status: 400 }
        );
      }

      // Check for cycles
      const hasCycle = await checkCycle(prisma, id, finalParentId);
      if (hasCycle) {
        return NextResponse.json(
          { error: 'Cannot set parent: would create a cycle' },
          { status: 400 }
        );
      }
    } else {
      // L0 must have null parent
      if (finalLevel !== CategoryLevel.L0) {
        return NextResponse.json(
          { error: 'Only L0 categories can have null parent' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (level !== undefined) updateData.level = level;
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (parentId !== undefined) updateData.parentId = finalParentId;

    // L3-only fields
    if (finalLevel === CategoryLevel.L3) {
      if (manufacturingGroup !== undefined) updateData.manufacturingGroup = manufacturingGroup === '__none__' ? null : (manufacturingGroup || null);
      if (defaultShippingProfile !== undefined) updateData.defaultShippingProfile = defaultShippingProfile === '__none__' ? null : (defaultShippingProfile || null);
      if (defaultSizeProfileId !== undefined) updateData.defaultSizeProfileId = defaultSizeProfileId === '__none__' ? null : (defaultSizeProfileId || null);
    } else {
      // Clear L3-only fields if not L3
      updateData.manufacturingGroup = null;
      updateData.defaultShippingProfile = null;
      updateData.defaultSizeProfileId = null;
    }

    const category = await prisma.productCategoryNode.update({
      where: { id },
      data: updateData,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
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

    return NextResponse.json(category);
  } catch (error: any) {
    console.error('Error updating category:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Category with this code or slug already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update category', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;

    // Check if category has children
    const children = await prisma.productCategoryNode.count({
      where: { parentId: id },
    });

    if (children > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with children. Delete children first.' },
        { status: 409 }
      );
    }

    // Check if category has templates
    const templates = await prisma.productTemplate.count({
      where: { categoryL3Id: id },
    });

    if (templates > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with product templates. Delete templates first.' },
        { status: 409 }
      );
    }

    await prisma.productCategoryNode.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete category', details: error.message },
      { status: 500 }
    );
  }
}
