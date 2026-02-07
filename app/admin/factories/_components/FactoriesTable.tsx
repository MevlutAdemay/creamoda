'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/ToastCenter';
import { listFactories, getCountries, toggleFactoryActive } from '../_actions';
import type { ManufacturingGroup, ProductQuality } from '@prisma/client';
import { Pencil } from 'lucide-react';

type FactoryRow = Awaited<ReturnType<typeof listFactories>>[number];
type Country = { id: string; name: string };

const MANUFACTURING_GROUPS: ManufacturingGroup[] = [
  'JERSEY',
  'WOVEN',
  'DENIM',
  'KNITWEAR',
  'OUTERWEAR',
  'LEATHER',
  'FOOTWEAR',
  'ACCESSORY',
];

export function FactoriesTable() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<FactoryRow[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryId, setCountryId] = useState<string>('__all__');
  const [manufacturingGroup, setManufacturingGroup] = useState<string>('__all__');
  const [isActiveFilter, setIsActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [factories, countryList] = await Promise.all([
        listFactories({
          search: search.trim() || undefined,
          countryId: countryId && countryId !== '__all__' ? countryId : undefined,
          manufacturingGroup:
            manufacturingGroup && manufacturingGroup !== '__all__'
              ? (manufacturingGroup as ManufacturingGroup)
              : undefined,
          isActive:
            isActiveFilter === 'all' ? undefined : isActiveFilter === 'active',
        }),
        getCountries(),
      ]);
      setItems(factories);
      setCountries(countryList);
    } catch (e) {
      toast({ title: 'Error', message: 'Failed to load factories', kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, countryId, manufacturingGroup, isActiveFilter]);

  const handleToggle = async (id: string, current: boolean) => {
    setTogglingId(id);
    try {
      await toggleFactoryActive(id, !current);
      setItems((prev) =>
        prev.map((f) => (f.id === id ? { ...f, isActive: !current } : f))
      );
      router.refresh();
    } catch {
      toast({ title: 'Error', message: 'Failed to update', kind: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="search">Search (code / name)</Label>
          <Input
            id="search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Select value={countryId} onValueChange={setCountryId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Manufacturing group</Label>
          <Select value={manufacturingGroup} onValueChange={setManufacturingGroup}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {MANUFACTURING_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={isActiveFilter}
            onValueChange={(v) => setIsActiveFilter(v as 'all' | 'active' | 'inactive')}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Lead days</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>MOQ</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  No factories found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.code}</TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell>{f.country.name}</TableCell>
                  <TableCell>{f.manufacturingGroup}</TableCell>
                  <TableCell>{f.productQuality}</TableCell>
                  <TableCell>{f.factoryTier}</TableCell>
                  <TableCell>{f.baseLeadTimeDays}</TableCell>
                  <TableCell>{f.baseDailyCapacity}</TableCell>
                  <TableCell>{f.defaultMoq}</TableCell>
                  <TableCell>
                    <Switch
                      checked={f.isActive}
                      disabled={togglingId === f.id}
                      onCheckedChange={() => handleToggle(f.id, f.isActive)}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(f.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/factories/${f.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
