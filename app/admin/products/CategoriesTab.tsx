/**
 * Categories Tab Component - Tree-Aware
 * Manages ProductCategoryNode as a 4-level tree (L0->L1->L2->L3)
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/ToastCenter';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { CategoryLevel, ManufacturingGroup, ShippingProfile } from '@prisma/client';

type Category = {
  id: string;
  level: CategoryLevel;
  code: string;
  name: string;
  slug: string;
  parentId: string | null;
  manufacturingGroup: ManufacturingGroup | null;
  defaultShippingProfile: ShippingProfile | null;
  defaultSizeProfileId: string | null;
  defaultSizeProfile: { id: string; name: string } | null;
  isActive: boolean;
  children?: Category[];
};

type FlatCategory = {
  id: string;
  level: CategoryLevel;
  code: string;
  name: string;
  slug: string;
  parentId: string | null;
  manufacturingGroup: ManufacturingGroup | null;
  defaultShippingProfile: ShippingProfile | null;
  defaultSizeProfileId: string | null;
  defaultSizeProfile: { id: string; name: string } | null;
  isActive: boolean;
};

function getNextLevel(level: CategoryLevel): CategoryLevel | null {
  switch (level) {
    case CategoryLevel.L0: return CategoryLevel.L1;
    case CategoryLevel.L1: return CategoryLevel.L2;
    case CategoryLevel.L2: return CategoryLevel.L3;
    default: return null;
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CategoriesTab() {
  const [tree, setTree] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<FlatCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentForChild, setParentForChild] = useState<Category | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [autoGenerateSlug, setAutoGenerateSlug] = useState(true);
  const toast = useToast();

  const [formData, setFormData] = useState({
    level: 'L0' as CategoryLevel,
    code: '',
    name: '',
    slug: '',
    parentId: '__none__',
    manufacturingGroup: '__none__',
    defaultShippingProfile: '__none__',
    defaultSizeProfileId: '__none__',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/products/categories?tree=1');
      if (res.ok) {
        const data = await res.json();
        setTree(data);
        // Flatten for parent selection
        const flatten = (nodes: Category[], result: FlatCategory[] = []): FlatCategory[] => {
          for (const node of nodes) {
            result.push({
              id: node.id,
              level: node.level,
              code: node.code,
              name: node.name,
              slug: node.slug,
              parentId: node.parentId,
              manufacturingGroup: node.manufacturingGroup,
              defaultShippingProfile: node.defaultShippingProfile,
              defaultSizeProfileId: node.defaultSizeProfileId,
              defaultSizeProfile: node.defaultSizeProfile,
              isActive: node.isActive,
            });
            if (node.children) {
              flatten(node.children, result);
            }
          }
          return result;
        };
        setFlatCategories(flatten(data));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateRoot = () => {
    setEditingCategory(null);
    setParentForChild(null);
    setFormData({
      level: CategoryLevel.L0,
      code: '',
      name: '',
      slug: '',
      parentId: '__none__',
      manufacturingGroup: '__none__',
      defaultShippingProfile: '__none__',
      defaultSizeProfileId: '__none__',
    });
    setAutoGenerateSlug(true);
    setDialogOpen(true);
  };

  const handleAddChild = (parent: Category) => {
    const nextLevel = getNextLevel(parent.level);
    if (!nextLevel) {
      toast({ title: 'Error', message: 'Cannot add child: maximum depth reached', kind: 'error' });
      return;
    }

    setEditingCategory(null);
    setParentForChild(parent);
    setFormData({
      level: nextLevel,
      code: '',
      name: '',
      slug: '',
      parentId: parent.id,
      manufacturingGroup: '__none__',
      defaultShippingProfile: '__none__',
      defaultSizeProfileId: '__none__',
    });
    setAutoGenerateSlug(true);
    setDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setParentForChild(null);
    setFormData({
      level: category.level,
      code: category.code,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId || '__none__',
      manufacturingGroup: category.manufacturingGroup || '__none__',
      defaultShippingProfile: category.defaultShippingProfile || '__none__',
      defaultSizeProfileId: category.defaultSizeProfileId || '__none__',
    });
    setAutoGenerateSlug(false);
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: autoGenerateSlug ? generateSlug(name) : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      level: formData.level,
      code: formData.code,
      name: formData.name,
      slug: formData.slug,
      parentId: formData.parentId === '__none__' ? null : formData.parentId,
    };

    // L3-only fields
    if (formData.level === CategoryLevel.L3) {
      payload.manufacturingGroup = formData.manufacturingGroup === '__none__' ? null : formData.manufacturingGroup;
      payload.defaultShippingProfile = formData.defaultShippingProfile === '__none__' ? null : formData.defaultShippingProfile;
      payload.defaultSizeProfileId = formData.defaultSizeProfileId === '__none__' ? null : formData.defaultSizeProfileId;
    }

    try {
      const url = editingCategory
        ? `/api/admin/products/categories/${editingCategory.id}`
        : '/api/admin/products/categories';
      const method = editingCategory ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: 'Success', message: `Category ${editingCategory ? 'updated' : 'created'} successfully`, kind: 'success' });
        setDialogOpen(false);
        fetchCategories();
        // Expand parent if adding child
        if (parentForChild) {
          setExpandedIds((prev) => new Set(prev).add(parentForChild.id));
        }
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to save category', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to save category', kind: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/products/categories/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Success', message: 'Category deleted successfully', kind: 'success' });
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchCategories();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to delete category', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to delete category', kind: 'error' });
    }
  };

  // Get valid parent options (filter by level)
  const getValidParents = (level: CategoryLevel): FlatCategory[] => {
    const requiredParentLevel = getNextLevel(level);
    if (requiredParentLevel === null) return []; // L0 has no parent
    return flatCategories.filter((cat) => cat.level === requiredParentLevel);
  };

  const validParents = editingCategory ? getValidParents(formData.level) : [];

  const renderNode = (node: Category, depth: number = 0): React.ReactElement => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const nextLevel = getNextLevel(node.level);

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 px-2 hover:bg-accent rounded"
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-1 hover:bg-accent rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <Badge variant="outline">{node.level}</Badge>
          <span className="font-mono text-sm">{node.code}</span>
          <span className="flex-1">{node.name}</span>
          <span className="text-sm text-muted-foreground">{node.slug}</span>
          {!node.isActive && <Badge variant="secondary">Inactive</Badge>}

          <div className="flex gap-1">
            {nextLevel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddChild(node)}
                title={`Add ${nextLevel} child`}
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(node)}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeletingId(node.id);
                setDeleteConfirmOpen(true);
              }}
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading categories...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Categories</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateRoot}>
              <Plus className="w-4 h-4 mr-2" />
              Create Root (L0)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCategory
                  ? 'Edit Category'
                  : parentForChild
                  ? `Add ${formData.level} Child to ${parentForChild.name}`
                  : 'Create Root Category (L0)'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Level *</label>
                  <Select
                    value={formData.level}
                    onValueChange={(value) => {
                      const newLevel = value as CategoryLevel;
                      setFormData((prev) => ({
                        ...prev,
                        level: newLevel,
                        parentId: newLevel === CategoryLevel.L0 ? '__none__' : prev.parentId,
                      }));
                    }}
                    disabled={!!parentForChild || !!editingCategory}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L0">L0</SelectItem>
                      <SelectItem value="L1">L1</SelectItem>
                      <SelectItem value="L2">L2</SelectItem>
                      <SelectItem value="L3">L3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Code *</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Slug *</label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={autoGenerateSlug}
                      onCheckedChange={(checked) => {
                        setAutoGenerateSlug(checked as boolean);
                        if (checked) {
                          setFormData((prev) => ({ ...prev, slug: generateSlug(prev.name) }));
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Auto-generate from name</span>
                  </div>
                </div>
                <Input
                  value={formData.slug}
                  onChange={(e) => {
                    setFormData({ ...formData, slug: e.target.value });
                    setAutoGenerateSlug(false);
                  }}
                  required
                />
              </div>

              {!parentForChild && (
                <div>
                  <label className="text-sm font-medium">Parent Category</label>
                  <Select
                    value={formData.parentId}
                    onValueChange={(value) => setFormData({ ...formData, parentId: value })}
                    disabled={formData.level === CategoryLevel.L0 || !!editingCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.level === CategoryLevel.L0 ? (
                        <SelectItem value="__none__">None (L0 must be root)</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="__none__">None</SelectItem>
                          {validParents.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              [{cat.level}] {cat.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.level === CategoryLevel.L3 && (
                <>
                  <div>
                    <label className="text-sm font-medium">Manufacturing Group</label>
                    <Select
                      value={formData.manufacturingGroup}
                      onValueChange={(value) => setFormData({ ...formData, manufacturingGroup: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {Object.values(ManufacturingGroup).map((group) => (
                          <SelectItem key={group} value={group}>
                            {group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Default Shipping Profile</label>
                    <Select
                      value={formData.defaultShippingProfile}
                      onValueChange={(value) => setFormData({ ...formData, defaultShippingProfile: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {Object.values(ShippingProfile).map((profile) => (
                          <SelectItem key={profile} value={profile}>
                            {profile}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <div className="p-2">
          {tree.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No categories found. Create a root (L0) category to get started.
            </div>
          ) : (
            tree.map((node) => renderNode(node))
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this category? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
