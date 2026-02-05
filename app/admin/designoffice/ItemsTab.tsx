// app/admin/designoffice/ItemsTab.tsx

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/ToastCenter';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { Plus, Pencil, Trash2 } from 'lucide-react';

type DesignStudio = {
  id: string;
  code: string;
  title: string;
  styleTag: string;
  quality: string;
};

type ProductTemplate = {
  id: string;
  code: string;
  name: string;
  productQuality: string;
  styleTags: string[];
  productSeason: string;
};

type DesignStudioItem = {
  id: string;
  studioId: string;
  productTemplateId: string;
  isFeatured: boolean;
  sortOrder: number;
  note: string | null;
  productTemplate: ProductTemplate;
};

export default function ItemsTab() {
  const [studios, setStudios] = useState<DesignStudio[]>([]);
  const [selectedStudioId, setSelectedStudioId] = useState<string>('');
  const [items, setItems] = useState<DesignStudioItem[]>([]);
  const [products, setProducts] = useState<ProductTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DesignStudioItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    productTemplateId: '',
    isFeatured: false,
    sortOrder: '0',
    note: '',
  });

  useEffect(() => {
    fetchStudios();
  }, []);

  useEffect(() => {
    if (selectedStudioId) {
      fetchItems();
      fetchProducts();
    } else {
      setItems([]);
      setProducts([]);
    }
  }, [selectedStudioId]);

  const fetchStudios = async () => {
    try {
      const res = await fetch('/api/admin/design-studios');
      if (res.ok) {
        const data = await res.json();
        setStudios(data.studios || []);
      }
    } catch (error) {
      console.error('Error fetching studios:', error);
    }
  };

  const fetchItems = async () => {
    if (!selectedStudioId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/design-studios/${selectedStudioId}/items`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!selectedStudioId) return;
    
    // Get selected studio to filter products
    const studioRes = await fetch('/api/admin/design-studios');
    if (!studioRes.ok) return;
    
    const studioData = await studioRes.json();
    const selectedStudio = studioData.studios?.find((s: DesignStudio) => s.id === selectedStudioId);
    if (!selectedStudio) return;

    setLoadingProducts(true);
    try {
      const res = await fetch(
        `/api/admin/design-studios/products?styleTag=${selectedStudio.styleTag}&quality=${selectedStudio.quality}`
      );
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      productTemplateId: '',
      isFeatured: false,
      sortOrder: '0',
      note: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (item: DesignStudioItem) => {
    setEditingItem(item);
    setFormData({
      productTemplateId: item.productTemplateId,
      isFeatured: item.isFeatured,
      sortOrder: item.sortOrder.toString(),
      note: item.note || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudioId) {
      toast({
        title: 'Error',
        message: 'Please select a design studio first',
        kind: 'error',
      });
      return;
    }

    try {
      const url = editingItem
        ? `/api/admin/design-studios/items/${editingItem.id}`
        : `/api/admin/design-studios/${selectedStudioId}/items`;
      const method = editingItem ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sortOrder: parseInt(formData.sortOrder) || 0,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Success',
          message: `Item ${editingItem ? 'updated' : 'created'} successfully`,
          kind: 'success',
        });
        setDialogOpen(false);
        fetchItems();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          message: data.error || 'Failed to save item',
          kind: 'error',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        message: 'Failed to save item',
        kind: 'error',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/design-studios/items/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({
          title: 'Success',
          message: 'Item deleted successfully',
          kind: 'success',
        });
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchItems();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          message: data.error || 'Failed to delete item',
          kind: 'error',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        message: 'Failed to delete item',
        kind: 'error',
      });
    }
  };

  const selectedStudio = studios.find((s) => s.id === selectedStudioId);
  const availableProducts = products.filter(
    (p) => !items.some((item) => item.productTemplateId === p.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Studio Items</h2>
      </div>

      <div className="flex gap-4">
        <div className="w-64">
          <label className="text-sm font-medium mb-2 block">Select Design Studio</label>
          <Select value={selectedStudioId} onValueChange={setSelectedStudioId}>
            <SelectTrigger>
              <SelectValue placeholder="Select studio" />
            </SelectTrigger>
            <SelectContent>
              {studios.map((studio) => (
                <SelectItem key={studio.id} value={studio.id}>
                  {studio.code} - {studio.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStudioId && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate} disabled={!selectedStudioId}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Edit Studio Item' : 'Add Studio Item'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Product Template *</label>
                  <Select
                    value={formData.productTemplateId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, productTemplateId: value })
                    }
                    required
                    disabled={!!editingItem}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {(editingItem ? products : availableProducts).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.code} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedStudio && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Filtered by Style: {selectedStudio.styleTag}, Quality: {selectedStudio.quality}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Sort Order</label>
                    <Input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) =>
                        setFormData({ ...formData, sortOrder: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="isFeatured"
                      checked={formData.isFeatured}
                      onChange={(e) =>
                        setFormData({ ...formData, isFeatured: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <label htmlFor="isFeatured" className="text-sm font-medium cursor-pointer">
                      Featured
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Note</label>
                  <Input
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Optional note..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {selectedStudioId && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <ModaVerseLogoLoader size={40} className="text-primary" />
              <span className="text-muted-foreground">Loading items...</span>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Style Tags</TableHead>
                    <TableHead>Featured</TableHead>
                    <TableHead>Sort Order</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No items found for this studio
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.productTemplate.code}
                        </TableCell>
                        <TableCell>{item.productTemplate.name}</TableCell>
                        <TableCell>{item.productTemplate.productQuality}</TableCell>
                        <TableCell>
                          {item.productTemplate.styleTags.join(', ')}
                        </TableCell>
                        <TableCell>{item.isFeatured ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{item.sortOrder}</TableCell>
                        <TableCell>{item.note || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingId(item.id);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {!selectedStudioId && (
        <div className="text-center text-muted-foreground py-8">
          Please select a design studio to view and manage items
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Studio Item</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this item from the studio? This action cannot be undone.
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
