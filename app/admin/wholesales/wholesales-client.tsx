'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/ToastCenter';
import { Pencil, Trash2, Plus, Package } from 'lucide-react';
import { MarketZone, StyleTag } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

type Supplier = {
  id: string;
  name: string;
  marketZoneId: MarketZone;
  styleTag: StyleTag;
  countryId: string | null;
  cityId: string | null;
  minPriceMultiplier: string;
  maxPriceMultiplier: string;
  isActive: boolean;
  createdAt: Date;
  country: {
    id: string;
    name: string;
  } | null;
  city: {
    id: string;
    name: string;
  } | null;
  _count: {
    catalogItems: number;
  };
};

type MarketZoneOption = MarketZone;
type Country = { id: string; name: string; iso2: string; marketZone: MarketZone | null };
type City = { id: string; name: string; slug: string; countryId: string };
type StyleOption = { id: string; value: string; name: string };

type ApiList<T> = { items: T[] };

const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  marketZoneId: z.nativeEnum(MarketZone),
  styleTag: z.nativeEnum(StyleTag),
  countryId: z.string().optional(),
  cityId: z.string().optional(),
  minPriceMultiplier: z.string().refine((v) => {
    const num = parseFloat(v);
    return !isNaN(num) && num > 0;
  }, 'Must be a positive number'),
  maxPriceMultiplier: z.string().refine((v) => {
    const num = parseFloat(v);
    return !isNaN(num);
  }, 'Must be a valid number'),
  isActive: z.boolean(),
}).refine((data) => {
  const min = parseFloat(data.minPriceMultiplier);
  const max = parseFloat(data.maxPriceMultiplier);
  if (isNaN(min) || isNaN(max)) return true;
  return max >= min;
}, {
  message: 'maxPriceMultiplier must be >= minPriceMultiplier',
  path: ['maxPriceMultiplier'],
}).refine((data) => {
  if (data.cityId && !data.countryId) {
    return false;
  }
  return true;
}, {
  message: 'City requires country',
  path: ['cityId'],
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function WholesalesClient() {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/wholesales/suppliers', { cache: 'no-store' });
      const data = (await r.json()) as ApiList<Supplier>;
      setItems(data.items ?? []);
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to load suppliers', kind: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/wholesales/suppliers/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      toast({ title: 'Success', message: 'Supplier deleted', kind: 'success' });
      setDeleteConfirmOpen(false);
      setToDelete(null);
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      toast({ title: 'Error', message, kind: 'error' });
    }
  }

  function openDeleteConfirm(supplier: Supplier) {
    setToDelete(supplier);
    setDeleteConfirmOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Wholesale Suppliers</h1>
            <p className="text-sm text-muted-foreground">Manage wholesale suppliers and their catalog items</p>
          </div>
          <CreateSupplierDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
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
                  <TableHead>Name</TableHead>
                  <TableHead>Market Zone</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Multiplier Range</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Catalog Items</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No suppliers found
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.marketZoneId}</Badge>
                      </TableCell>
                      <TableCell>{item.country?.name || '-'}</TableCell>
                      <TableCell>{item.city?.name || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {item.minPriceMultiplier}x - {item.maxPriceMultiplier}x
                      </TableCell>
                      <TableCell>
                        {item.isActive ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item._count.catalogItems}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/wholesales/${item.id}`)}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Products
                          </Button>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {editItem && (
        <EditSupplierDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          item={editItem}
          onSuccess={() => {
            setEditItem(null);
            load();
          }}
        />
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {toDelete ? `Are you sure you want to delete "${toDelete.name}"? This action cannot be undone. If the supplier has catalog items, they will also be deleted.` : "Are you sure you want to delete this supplier?"}
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

function CreateSupplierDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [marketZones, setMarketZones] = useState<MarketZoneOption[]>([]);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      marketZoneId: MarketZone.EU_NORTH,
      styleTag: StyleTag.CASUAL,
      countryId: undefined,
      cityId: undefined,
      minPriceMultiplier: '1.40',
      maxPriceMultiplier: '1.60',
      isActive: true,
    },
  });

  const selectedMarketZone = form.watch('marketZoneId');
  const selectedCountryId = form.watch('countryId');

  useEffect(() => {
    async function loadMarketZones() {
      try {
        const res = await fetch('/api/admin/wholesales/marketzones');
        const data = await res.json();
        setMarketZones(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load market zones:', error);
      }
    }
    loadMarketZones();
  }, []);

  useEffect(() => {
    async function loadStyles() {
      try {
        const res = await fetch('/api/admin/products/styles');
        const data = await res.json();
        setStyles(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load styles:', error);
        toast({ title: 'Error', message: 'Failed to load styles', kind: 'error' });
      }
    }
    loadStyles();
  }, [toast]);

  useEffect(() => {
    if (!selectedMarketZone) {
      setCountries([]);
      form.setValue('countryId', undefined);
      form.setValue('cityId', undefined);
      return;
    }

    async function loadCountries() {
      try {
        setLoadingCountries(true);
        const res = await fetch(`/api/admin/wholesales/countries?marketZoneId=${selectedMarketZone}`);
        const data = await res.json();
        setCountries(Array.isArray(data) ? data : []);
        form.setValue('countryId', undefined);
        form.setValue('cityId', undefined);
      } catch (error) {
        console.error('Failed to load countries:', error);
        toast({ title: 'Error', message: 'Failed to load countries', kind: 'error' });
      } finally {
        setLoadingCountries(false);
      }
    }

    loadCountries();
  }, [selectedMarketZone, form, toast]);

  useEffect(() => {
    if (!selectedCountryId) {
      setCities([]);
      form.setValue('cityId', undefined);
      return;
    }

    async function loadCities() {
      try {
        setLoadingCities(true);
        const res = await fetch(`/api/admin/wholesales/cities?countryId=${selectedCountryId}`);
        const data = await res.json();
        setCities(Array.isArray(data) ? data : []);
        form.setValue('cityId', undefined);
      } catch (error) {
        console.error('Failed to load cities:', error);
        toast({ title: 'Error', message: 'Failed to load cities', kind: 'error' });
      } finally {
        setLoadingCities(false);
      }
    }

    loadCities();
  }, [selectedCountryId, form, toast]);

  useEffect(() => {
    if (!open) {
      form.reset();
      setCountries([]);
      setCities([]);
    }
  }, [open, form]);

  async function handleSubmit(data: SupplierFormData) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/wholesales/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          marketZoneId: data.marketZoneId,
          styleTag: data.styleTag,
          countryId: data.countryId || null,
          cityId: data.cityId || null,
          minPriceMultiplier: data.minPriceMultiplier.toString(),
          maxPriceMultiplier: data.maxPriceMultiplier.toString(),
          isActive: data.isActive,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Create failed');
      }

      toast({ title: 'Success', message: 'Supplier created', kind: 'success' });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Create failed';
      toast({ title: 'Error', message, kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Supplier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Supplier</DialogTitle>
          <DialogDescription>
            Create a new wholesale supplier. Fill in the required information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Supplier name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="marketZoneId">Market Zone *</Label>
            <Select
              value={form.watch('marketZoneId')}
              onValueChange={(value) => form.setValue('marketZoneId', value as MarketZone)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select market zone" />
              </SelectTrigger>
              <SelectContent>
                {marketZones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.marketZoneId && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.marketZoneId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="styleTag">Style *</Label>
            <Select
              value={form.watch('styleTag')}
              onValueChange={(value) => form.setValue('styleTag', value as StyleTag)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style.id} value={style.value}>
                    {style.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.styleTag && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.styleTag.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="countryId">Country</Label>
              <Select
                value={form.watch('countryId') || '__none__'}
                onValueChange={(value) => form.setValue('countryId', value === '__none__' ? undefined : value)}
                disabled={!selectedMarketZone || loadingCountries}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCountries ? "Loading..." : selectedMarketZone ? "Select country" : "Select market zone first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cityId">City</Label>
              <Select
                value={form.watch('cityId') || '__none__'}
                onValueChange={(value) => form.setValue('cityId', value === '__none__' ? undefined : value)}
                disabled={!selectedCountryId || loadingCities}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCities ? "Loading..." : selectedCountryId ? "Select city" : "Select country first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.cityId && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.cityId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minPriceMultiplier">Min Price Multiplier *</Label>
              <Input
                id="minPriceMultiplier"
                type="number"
                step="0.01"
                min="0.01"
                {...form.register('minPriceMultiplier')}
                placeholder="1.40"
              />
              {form.formState.errors.minPriceMultiplier && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.minPriceMultiplier.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="maxPriceMultiplier">Max Price Multiplier *</Label>
              <Input
                id="maxPriceMultiplier"
                type="number"
                step="0.01"
                min="0.01"
                {...form.register('maxPriceMultiplier')}
                placeholder="1.60"
              />
              {form.formState.errors.maxPriceMultiplier && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.maxPriceMultiplier.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={form.watch('isActive')}
              onCheckedChange={(checked) => form.setValue('isActive', checked)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditSupplierDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Supplier | null;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [marketZones, setMarketZones] = useState<MarketZoneOption[]>([]);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      marketZoneId: MarketZone.EU_NORTH,
      styleTag: StyleTag.CASUAL,
      countryId: undefined,
      cityId: undefined,
      minPriceMultiplier: '1.40',
      maxPriceMultiplier: '1.60',
      isActive: true,
    },
  });

  const selectedMarketZone = form.watch('marketZoneId');
  const selectedCountryId = form.watch('countryId');

  useEffect(() => {
    async function loadMarketZones() {
      try {
        const res = await fetch('/api/admin/wholesales/marketzones');
        const data = await res.json();
        setMarketZones(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load market zones:', error);
      }
    }
    loadMarketZones();
  }, []);

  useEffect(() => {
    async function loadStyles() {
      try {
        const res = await fetch('/api/admin/products/styles');
        const data = await res.json();
        setStyles(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load styles:', error);
        toast({ title: 'Error', message: 'Failed to load styles', kind: 'error' });
      }
    }
    loadStyles();
  }, [toast]);

  useEffect(() => {
    if (!selectedMarketZone) {
      setCountries([]);
      return;
    }

    async function loadCountries() {
      try {
        setLoadingCountries(true);
        const res = await fetch(`/api/admin/wholesales/countries?marketZoneId=${selectedMarketZone}`);
        const data = await res.json();
        setCountries(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load countries:', error);
        toast({ title: 'Error', message: 'Failed to load countries', kind: 'error' });
      } finally {
        setLoadingCountries(false);
      }
    }

    loadCountries();
  }, [selectedMarketZone, toast]);

  useEffect(() => {
    if (!selectedCountryId) {
      setCities([]);
      return;
    }

    async function loadCities() {
      try {
        setLoadingCities(true);
        const res = await fetch(`/api/admin/wholesales/cities?countryId=${selectedCountryId}`);
        const data = await res.json();
        setCities(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load cities:', error);
        toast({ title: 'Error', message: 'Failed to load cities', kind: 'error' });
      } finally {
        setLoadingCities(false);
      }
    }

    loadCities();
  }, [selectedCountryId, toast]);

  useEffect(() => {
    if (open && item) {
      form.reset({
        name: item.name,
        marketZoneId: item.marketZoneId,
        styleTag: item.styleTag,
        countryId: item.countryId || undefined,
        cityId: item.cityId || undefined,
        minPriceMultiplier: item.minPriceMultiplier,
        maxPriceMultiplier: item.maxPriceMultiplier,
        isActive: item.isActive,
      });
    }
  }, [open, item, form]);

  async function handleSubmit(data: SupplierFormData) {
    if (!item) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/wholesales/suppliers/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          marketZoneId: data.marketZoneId,
          styleTag: data.styleTag,
          countryId: data.countryId || null,
          cityId: data.cityId || null,
          minPriceMultiplier: data.minPriceMultiplier.toString(),
          maxPriceMultiplier: data.maxPriceMultiplier.toString(),
          isActive: data.isActive,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Update failed');
      }

      toast({ title: 'Success', message: 'Supplier updated', kind: 'success' });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      toast({ title: 'Error', message, kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Supplier</DialogTitle>
          <DialogDescription>
            Update supplier information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              {...form.register('name')}
              placeholder="Supplier name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="edit-marketZoneId">Market Zone *</Label>
            <Select
              value={form.watch('marketZoneId')}
              onValueChange={(value) => form.setValue('marketZoneId', value as MarketZone)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select market zone" />
              </SelectTrigger>
              <SelectContent>
                {marketZones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.marketZoneId && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.marketZoneId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="edit-styleTag">Style *</Label>
            <Select
              value={form.watch('styleTag')}
              onValueChange={(value) => form.setValue('styleTag', value as StyleTag)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style.id} value={style.value}>
                    {style.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.styleTag && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.styleTag.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-countryId">Country</Label>
              <Select
                value={form.watch('countryId') || '__none__'}
                onValueChange={(value) => form.setValue('countryId', value === '__none__' ? undefined : value)}
                disabled={!selectedMarketZone || loadingCountries}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCountries ? "Loading..." : selectedMarketZone ? "Select country" : "Select market zone first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-cityId">City</Label>
              <Select
                value={form.watch('cityId') || '__none__'}
                onValueChange={(value) => form.setValue('cityId', value === '__none__' ? undefined : value)}
                disabled={!selectedCountryId || loadingCities}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCities ? "Loading..." : selectedCountryId ? "Select city" : "Select country first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.cityId && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.cityId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-minPriceMultiplier">Min Price Multiplier *</Label>
              <Input
                id="edit-minPriceMultiplier"
                type="number"
                step="0.01"
                min="0.01"
                {...form.register('minPriceMultiplier')}
                placeholder="1.40"
              />
              {form.formState.errors.minPriceMultiplier && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.minPriceMultiplier.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-maxPriceMultiplier">Max Price Multiplier *</Label>
              <Input
                id="edit-maxPriceMultiplier"
                type="number"
                step="0.01"
                min="0.01"
                {...form.register('maxPriceMultiplier')}
                placeholder="1.60"
              />
              {form.formState.errors.maxPriceMultiplier && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.maxPriceMultiplier.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="edit-isActive"
              checked={form.watch('isActive')}
              onCheckedChange={(checked) => form.setValue('isActive', checked)}
            />
            <Label htmlFor="edit-isActive">Active</Label>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
