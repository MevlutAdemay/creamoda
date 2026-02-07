'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useToast } from '@/components/ui/ToastCenter';
import { createFactory, updateFactory, getCities } from '../_actions';
import { createFactorySchema, updateFactorySchema, type CreateFactoryInput } from '../_schemas';
import type { ManufacturingGroup, ProductQuality } from '@prisma/client';

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

const PRODUCT_QUALITIES: ProductQuality[] = ['STANDARD', 'PREMIUM', 'LUXURY'];

type Country = { id: string; name: string };
type City = { id: string; name: string };

type FactoryWithRelations = {
  id: string;
  code: string;
  name: string;
  countryId: string;
  cityId: string | null;
  manufacturingGroup: ManufacturingGroup;
  productQuality: ProductQuality;
  factoryTier: number;
  baseLeadTimeDays: number;
  baseDailyCapacity: number;
  defaultMoq: number;
  priceNoiseMinPct: number;
  priceNoiseMaxPct: number;
  isActive: boolean;
};

type FactoryFormProps = {
  initialData?: FactoryWithRelations | null;
  countries: Country[];
};

export function FactoryForm({ initialData, countries }: FactoryFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const isEdit = !!initialData?.id;

  const form = useForm<CreateFactoryInput>({
    resolver: zodResolver(createFactorySchema),
    defaultValues: initialData
      ? {
          code: initialData.code,
          name: initialData.name,
          countryId: initialData.countryId,
          cityId: initialData.cityId ?? undefined,
          manufacturingGroup: initialData.manufacturingGroup,
          productQuality: initialData.productQuality,
          factoryTier: initialData.factoryTier,
          baseLeadTimeDays: initialData.baseLeadTimeDays,
          baseDailyCapacity: initialData.baseDailyCapacity,
          defaultMoq: initialData.defaultMoq,
          priceNoiseMinPct: initialData.priceNoiseMinPct,
          priceNoiseMaxPct: initialData.priceNoiseMaxPct,
          isActive: initialData.isActive,
        }
      : {
          code: '',
          name: '',
          countryId: '',
          cityId: undefined,
          manufacturingGroup: 'JERSEY',
          productQuality: 'STANDARD',
          factoryTier: 1,
          baseLeadTimeDays: 28,
          baseDailyCapacity: 100,
          defaultMoq: 50,
          priceNoiseMinPct: 0.02,
          priceNoiseMaxPct: 0.08,
          isActive: true,
        },
  });

  const selectedCountryId = form.watch('countryId');

  useEffect(() => {
    if (!selectedCountryId) {
      setCities([]);
      form.setValue('cityId', undefined);
      return;
    }
    let cancelled = false;
    setLoadingCities(true);
    getCities(selectedCountryId)
      .then((list) => {
        if (!cancelled) setCities(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId, form]);

  const onSubmit = async (data: CreateFactoryInput) => {
    if (isEdit && initialData?.id) {
      const result = await updateFactory(initialData.id, data);
      if (result.ok) {
        toast({ title: 'Saved', message: 'Factory updated.', kind: 'success' });
        router.refresh();
        return;
      }
      toast({ title: 'Validation error', message: Object.values(result.error ?? {}).flat().join(', '), kind: 'error' });
      form.setError('root', { message: 'Fix errors above' });
      return;
    }
    const result = await createFactory(data);
    if (result.ok && result.id) {
      toast({ title: 'Created', message: 'Factory created.', kind: 'success' });
      form.reset({
        code: '',
        name: '',
        countryId: '',
        cityId: undefined,
        manufacturingGroup: 'JERSEY',
        productQuality: 'STANDARD',
        factoryTier: 1,
        baseLeadTimeDays: 28,
        baseDailyCapacity: 100,
        defaultMoq: 50,
        priceNoiseMinPct: 0.02,
        priceNoiseMaxPct: 0.08,
        isActive: true,
      });
      router.refresh();
      return;
    }
    if (!result.ok && result.error) {
      toast({ title: 'Validation error', message: Object.values(result.error).flat().join(', '), kind: 'error' });
      return;
    }
    toast({ title: 'Error', message: 'Failed to create factory', kind: 'error' });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            {...form.register('code')}
            onBlur={(e) => e.target.value && form.setValue('code', e.target.value.toUpperCase())}
            placeholder="e.g. TR-01"
          />
          {form.formState.errors.code && (
            <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...form.register('name')} placeholder="Factory name" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Country</Label>
          <Select
            value={form.watch('countryId') || ''}
            onValueChange={(v) => form.setValue('countryId', v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.countryId && (
            <p className="text-sm text-destructive">{form.formState.errors.countryId.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>City (optional)</Label>
          <Select
            value={form.watch('cityId') ?? '__none__'}
            onValueChange={(v) => form.setValue('cityId', v === '__none__' ? undefined : v)}
            disabled={!selectedCountryId || loadingCities}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loadingCities ? 'Loading...' : 'Select city'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Manufacturing group</Label>
          <Select
            value={form.watch('manufacturingGroup')}
            onValueChange={(v) => form.setValue('manufacturingGroup', v as ManufacturingGroup)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANUFACTURING_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.manufacturingGroup && (
            <p className="text-sm text-destructive">{form.formState.errors.manufacturingGroup.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Quality band</Label>
          <Select
            value={form.watch('productQuality')}
            onValueChange={(v) => form.setValue('productQuality', v as ProductQuality)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_QUALITIES.map((q) => (
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.productQuality && (
            <p className="text-sm text-destructive">{form.formState.errors.productQuality.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="factoryTier">Factory tier (1–5)</Label>
          <Input
            id="factoryTier"
            type="number"
            min={1}
            max={5}
            {...form.register('factoryTier', { valueAsNumber: true })}
          />
          {form.formState.errors.factoryTier && (
            <p className="text-sm text-destructive">{form.formState.errors.factoryTier.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="baseLeadTimeDays">Base lead time (days)</Label>
          <Input
            id="baseLeadTimeDays"
            type="number"
            min={1}
            {...form.register('baseLeadTimeDays', { valueAsNumber: true })}
          />
          {form.formState.errors.baseLeadTimeDays && (
            <p className="text-sm text-destructive">{form.formState.errors.baseLeadTimeDays.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="baseDailyCapacity">Base daily capacity</Label>
          <Input
            id="baseDailyCapacity"
            type="number"
            min={1}
            {...form.register('baseDailyCapacity', { valueAsNumber: true })}
          />
          {form.formState.errors.baseDailyCapacity && (
            <p className="text-sm text-destructive">{form.formState.errors.baseDailyCapacity.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="defaultMoq">Default MOQ</Label>
          <Input id="defaultMoq" type="number" min={1} {...form.register('defaultMoq', { valueAsNumber: true })} />
          {form.formState.errors.defaultMoq && (
            <p className="text-sm text-destructive">{form.formState.errors.defaultMoq.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priceNoiseMinPct">Price noise min (0–0.5)</Label>
          <Input
            id="priceNoiseMinPct"
            type="number"
            step={0.01}
            min={0}
            max={0.5}
            {...form.register('priceNoiseMinPct', { valueAsNumber: true })}
          />
          {form.formState.errors.priceNoiseMinPct && (
            <p className="text-sm text-destructive">{form.formState.errors.priceNoiseMinPct.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceNoiseMaxPct">Price noise max (0–0.5)</Label>
          <Input
            id="priceNoiseMaxPct"
            type="number"
            step={0.01}
            min={0}
            max={0.5}
            {...form.register('priceNoiseMaxPct', { valueAsNumber: true })}
          />
          {form.formState.errors.priceNoiseMaxPct && (
            <p className="text-sm text-destructive">{form.formState.errors.priceNoiseMaxPct.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isActive"
          checked={form.watch('isActive')}
          onCheckedChange={(v) => form.setValue('isActive', v)}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/factories')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
