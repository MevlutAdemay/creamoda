'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { createFactorySchema, updateFactorySchema, type CreateFactoryInput, type UpdateFactoryInput, type ListFilters } from './_schemas';

export async function listFactories(filters: ListFilters = {}) {
  const where: Prisma.FactoryWhereInput = {};

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (filters.countryId) where.countryId = filters.countryId;
  if (filters.manufacturingGroup) where.manufacturingGroup = filters.manufacturingGroup;
  if (filters.isActive !== undefined && filters.isActive !== 'all') {
    where.isActive = filters.isActive === true;
  }

  const items = await prisma.factory.findMany({
    where,
    include: { country: { select: { id: true, name: true } }, city: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return items;
}

export async function getCountries() {
  return prisma.country.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

export async function getCities(countryId?: string) {
  if (!countryId) return [];
  return prisma.city.findMany({
    where: { countryId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

export async function getFactory(id: string) {
  const f = await prisma.factory.findUnique({
    where: { id },
    include: { country: { select: { id: true, name: true } }, city: { select: { id: true, name: true } } },
  });
  return f;
}

export async function createFactory(data: CreateFactoryInput) {
  const parsed = createFactorySchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const created = await prisma.factory.create({
    data: {
      code: d.code,
      name: d.name,
      countryId: d.countryId,
      cityId: d.cityId || null,
      manufacturingGroup: d.manufacturingGroup,
      productQuality: d.productQuality,
      factoryTier: d.factoryTier,
      baseLeadTimeDays: d.baseLeadTimeDays,
      baseDailyCapacity: d.baseDailyCapacity,
      defaultMoq: d.defaultMoq,
      priceNoiseMinPct: d.priceNoiseMinPct,
      priceNoiseMaxPct: d.priceNoiseMaxPct,
      isActive: d.isActive,
    },
  });
  revalidatePath('/admin/factories');
  return { ok: true as const, id: created.id };
}

export async function updateFactory(id: string, data: UpdateFactoryInput) {
  const parsed = updateFactorySchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  await prisma.factory.update({
    where: { id },
    data: {
      code: d.code,
      name: d.name,
      countryId: d.countryId,
      cityId: d.cityId || null,
      manufacturingGroup: d.manufacturingGroup,
      productQuality: d.productQuality,
      factoryTier: d.factoryTier,
      baseLeadTimeDays: d.baseLeadTimeDays,
      baseDailyCapacity: d.baseDailyCapacity,
      defaultMoq: d.defaultMoq,
      priceNoiseMinPct: d.priceNoiseMinPct,
      priceNoiseMaxPct: d.priceNoiseMaxPct,
      isActive: d.isActive,
    },
  });
  revalidatePath('/admin/factories');
  revalidatePath(`/admin/factories/${id}`);
  return { ok: true as const };
}

export async function toggleFactoryActive(id: string, isActive: boolean) {
  await prisma.factory.update({ where: { id }, data: { isActive } });
  revalidatePath('/admin/factories');
  revalidatePath(`/admin/factories/${id}`);
  return { ok: true as const };
}
