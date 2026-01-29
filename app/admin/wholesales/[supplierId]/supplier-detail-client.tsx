'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/ToastCenter';
import { Pencil, Trash2, Plus, ArrowLeft, Search } from 'lucide-react';
import { MarketZone } from '@prisma/client';

type Supplier = {
  id: string;
  name: string;
  marketZoneId: MarketZone;
  country: { id: string; name: string } | null;
  city: { id: string; name: string } | null;
  minPriceMultiplier: string;
  maxPriceMultiplier: string;
  isActive: boolean;
};

type CatalogItem = {
  id: string;
  wholesalePrice: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  productTemplate: {
    id: string;
    code: string;
    name: string;
    baseCost: string;
  };
};

type ProductTemplate = {
  id: string;
  code: string;
  name: string;
  baseCost: string;
};

type CatalogResponse = {
  supplier: Supplier;
  items: CatalogItem[];
};

type ApiList<T> = { items: T[] };

export default function SupplierDetailClient({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const toast = useToast();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CatalogItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/wholesales/suppliers/${supplierId}/catalog`, { cache: 'no-store' });
      const data = (await r.json()) as CatalogResponse;
      setSupplier(data.supplier);
      setItems(data.items ?? []);
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to load supplier catalog', kind: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (supplierId) {
      load();
    }
  }, [supplierId]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/wholesales/suppliers/${supplierId}/catalog/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      toast({ title: 'Success', message: 'Catalog item deleted', kind: 'success' });
      setDeleteConfirmOpen(false);
      setToDelete(null);
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      toast({ title: 'Error', message, kind: 'error' });
    }
  }

  function openDeleteConfirm(item: CatalogItem) {
    setToDelete(item);
    setDeleteConfirmOpen(true);
  }

  if (loading && !supplier) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!supplier) {
    return <div className="text-sm text-destructive">Supplier not found</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/wholesales')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{supplier.name}</h1>
            <p className="text-sm text-muted-foreground">Catalog Items Management</p>
          </div>
        </div>

        {/* Supplier Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
            <CardDescription>Details about this wholesale supplier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Market Zone</div>
                <div className="font-medium">
                  <Badge variant="outline">{supplier.marketZoneId}</Badge>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Location</div>
                <div className="font-medium">
                  {supplier.country?.name || '-'}
                  {supplier.city && `, ${supplier.city.name}`}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Price Multiplier Range</div>
                <div className="font-medium">
                  {supplier.minPriceMultiplier}x - {supplier.maxPriceMultiplier}x
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div>
                  {supplier.isActive ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Catalog Items */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Catalog Items</h2>
          <CreateCatalogItemDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            supplier={supplier}
            supplierId={supplierId}
            onSuccess={() => {
              setCreateOpen(false);
              load();
            }}
          />
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="border rounded-lg">
            <Table className="w-full text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Base Cost</TableHead>
                  <TableHead>Wholesale Price</TableHead>
                  <TableHead>Multiplier</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No catalog items found. Add products to this supplier's catalog.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const baseCost = parseFloat(item.productTemplate.baseCost);
                    const wholesalePrice = parseFloat(item.wholesalePrice);
                    const multiplier = baseCost > 0 ? (wholesalePrice / baseCost).toFixed(2) : '0.00';

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productTemplate.code}</TableCell>
                        <TableCell>{item.productTemplate.name}</TableCell>
                        <TableCell className="text-xs">
                          ${parseFloat(item.productTemplate.baseCost).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${parseFloat(item.wholesalePrice).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {multiplier}x
                        </TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditItem(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteConfirm(item)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {editItem && (
        <EditCatalogItemDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          item={editItem}
          supplierId={supplierId}
          onSuccess={() => {
            setEditItem(null);
            load();
          }}
        />
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Catalog Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {toDelete ? `Are you sure you want to delete "${toDelete.productTemplate.name}" from the catalog? This action cannot be undone.` : "Are you sure you want to delete this item?"}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={() => toDelete && handleDelete(toDelete.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateCatalogItemDialog({
  open,
  onOpenChange,
  supplier,
  supplierId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  supplierId: string;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<ProductTemplate[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductTemplate | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [searching, setSearching] = useState(false);

  async function searchProducts() {
    if (!searchQuery.trim()) {
      setProducts([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/admin/wholesales/product-templates?query=${encodeURIComponent(searchQuery)}`);
      const data = (await res.json()) as ApiList<ProductTemplate>;
      setProducts(data.items ?? []);
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to search products', kind: 'error' });
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleSubmit() {
    if (!selectedProduct) {
      toast({ title: 'Error', message: 'Please select a product', kind: 'error' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/wholesales/suppliers/${supplierId}/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productTemplateId: selectedProduct.id,
          isActive,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Create failed');
      }

      toast({ title: 'Success', message: 'Product added to catalog', kind: 'success' });
      onSuccess();
      setSelectedProduct(null);
      setSearchQuery('');
      setProducts([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Create failed';
      toast({ title: 'Error', message, kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const previewMultiplier = selectedProduct ? 
    ((parseFloat(supplier.minPriceMultiplier) + parseFloat(supplier.maxPriceMultiplier)) / 2).toFixed(2) : '0.00';
  const previewPrice = selectedProduct ? 
    (parseFloat(selectedProduct.baseCost) * parseFloat(previewMultiplier)).toFixed(2) : '0.00';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Product to Catalog</DialogTitle>
          <DialogDescription>
            Search and select a product template to add to this supplier's catalog.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="search">Search Products</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {searching && (
            <div className="text-sm text-muted-foreground">Searching...</div>
          )}

          {products.length > 0 && (
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Base Cost</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium text-xs">{product.code}</TableCell>
                      <TableCell className="text-xs">{product.name}</TableCell>
                      <TableCell className="text-xs">${parseFloat(product.baseCost).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={selectedProduct?.id === product.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedProduct(product)}
                        >
                          {selectedProduct?.id === product.id ? 'Selected' : 'Select'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {selectedProduct && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Selected Product</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Product</div>
                    <div className="font-medium">{selectedProduct.code} - {selectedProduct.name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Base Cost</div>
                    <div className="font-medium">${parseFloat(selectedProduct.baseCost).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Preview Multiplier</div>
                    <div className="font-medium">{previewMultiplier}x</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Preview Wholesale Price</div>
                    <div className="font-medium">${previewPrice}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  * Actual price will be randomly calculated between {supplier.minPriceMultiplier}x and {supplier.maxPriceMultiplier}x
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving || !selectedProduct}>
            {saving ? 'Adding...' : 'Add to Catalog'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCatalogItemDialog({
  open,
  onOpenChange,
  item,
  supplierId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CatalogItem | null;
  supplierId: string;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open && item) {
      setWholesalePrice(item.wholesalePrice);
      setIsActive(item.isActive);
    }
  }, [open, item]);

  async function handleSubmit() {
    if (!item) return;

    const price = parseFloat(wholesalePrice);
    if (isNaN(price) || price <= 0) {
      toast({ title: 'Error', message: 'Please enter a valid price', kind: 'error' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/wholesales/suppliers/${supplierId}/catalog/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wholesalePrice: price.toString(),
          isActive,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Update failed');
      }

      toast({ title: 'Success', message: 'Catalog item updated', kind: 'success' });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      toast({ title: 'Error', message, kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (!item) return null;

  const baseCost = parseFloat(item.productTemplate.baseCost);
  const currentPrice = parseFloat(wholesalePrice);
  const multiplier = baseCost > 0 && !isNaN(currentPrice) ? (currentPrice / baseCost).toFixed(2) : '0.00';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Catalog Item</DialogTitle>
          <DialogDescription>
            Update wholesale price and status for this product.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm space-y-2">
            <div>
              <span className="text-muted-foreground">Product: </span>
              <span className="font-medium">{item.productTemplate.code} - {item.productTemplate.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Base Cost: </span>
              <span className="font-medium">${parseFloat(item.productTemplate.baseCost).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="wholesalePrice">Wholesale Price *</Label>
            <Input
              id="wholesalePrice"
              type="number"
              step="0.01"
              min="0.01"
              value={wholesalePrice}
              onChange={(e) => setWholesalePrice(e.target.value)}
              placeholder="Enter price"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Current multiplier: {multiplier}x
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="edit-isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="edit-isActive">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Updating...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
