import { z } from 'zod';
import type { ManufacturingGroup, ProductQuality } from '@prisma/client';

const codeSchema = z
  .string()
  .min(2, 'Code must be 2–32 characters')
  .max(32, 'Code must be 2–32 characters')
  .regex(/^[A-Z0-9_-]+$/i, 'Only letters, numbers, _ and - allowed')
  .transform((s) => s.toUpperCase());

export const createFactorySchema = z
  .object({
    code: codeSchema,
    name: z.string().min(2, 'Name 2–64 chars').max(64, 'Name 2–64 chars'),
    countryId: z.string().min(1, 'Country is required'),
    cityId: z.string().optional().nullable(),
    manufacturingGroup: z.enum([
      'JERSEY',
      'WOVEN',
      'DENIM',
      'KNITWEAR',
      'OUTERWEAR',
      'LEATHER',
      'FOOTWEAR',
      'ACCESSORY',
    ]) as z.ZodType<ManufacturingGroup>,
    productQuality: z.enum(['STANDARD', 'PREMIUM', 'LUXURY']) as z.ZodType<ProductQuality>,
    factoryTier: z.number().int().min(1).max(5),
    baseLeadTimeDays: z.number().int().positive('Must be positive'),
    baseDailyCapacity: z.number().int().positive('Must be positive'),
    defaultMoq: z.number().int().positive('Must be positive'),
    priceNoiseMinPct: z.number().min(0).max(0.5),
    priceNoiseMaxPct: z.number().min(0).max(0.5),
    isActive: z.boolean(),
  })
  .refine((d) => d.priceNoiseMaxPct >= d.priceNoiseMinPct, {
    message: 'Max noise must be >= min',
    path: ['priceNoiseMaxPct'],
  });

export const updateFactorySchema = createFactorySchema;

export type CreateFactoryInput = z.infer<typeof createFactorySchema>;
export type UpdateFactoryInput = z.infer<typeof updateFactorySchema>;

export type ListFilters = {
  search?: string;
  countryId?: string;
  manufacturingGroup?: ManufacturingGroup;
  isActive?: boolean | 'all';
};
