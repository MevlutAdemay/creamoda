/**
 * country_prod.seed.ts - production-only countries (marketZone = null)
 * Targets: Egypt, Tunisia, China, India, Bangladesh
 * Each country: 2 regions, 4 cities
 *
 * Use: seedProductionCountries(prisma) or import and run from seed.ts
 */

import { PrismaClient, Prisma, HeatZone } from '@prisma/client';

export const productionCountriesSeed = [
  // =========================
  // EGYPT
  // =========================
  {
    country: {
      name: 'Mısır',
      iso2: 'EG',
      iso3: 'EGY',
      slug: 'misir',
      heatZone: 'ZONE7',
      marketZone: null,
      hemisphere: 'NORTHERN',

      salaryMultiplier: '0.900',
      rentMultiplier: '0.900',
      overheadMultiplier: '0.950',
      priceMultiplier: '0.950',
      productionMultiplier: '1.050',
    },
    regions: [
      { name: 'Kahire Bölgesi', slug: 'kahire-bolgesi' },
      { name: 'İskenderiye Bölgesi', slug: 'iskenderiye-bolgesi' },
    ],
    cities: [
      { name: 'Kahire', slug: 'kahire', regionSlug: 'kahire-bolgesi' },
      { name: 'Giza', slug: 'giza', regionSlug: 'kahire-bolgesi' },
      { name: 'İskenderiye', slug: 'iskenderiye', regionSlug: 'iskenderiye-bolgesi' },
      { name: 'Port Said', slug: 'port-said', regionSlug: 'iskenderiye-bolgesi' },
    ],
  },

  // =========================
  // TUNISIA
  // =========================
  {
    country: {
      name: 'Tunus',
      iso2: 'TN',
      iso3: 'TUN',
      slug: 'tunus',
      heatZone: 'ZONE6',
      marketZone: null,
      hemisphere: 'NORTHERN',

      salaryMultiplier: '0.920',
      rentMultiplier: '0.920',
      overheadMultiplier: '0.970',
      priceMultiplier: '0.980',
      productionMultiplier: '1.020',
    },
    regions: [
      { name: 'Tunis Bölgesi', slug: 'tunis-bolgesi' },
      { name: 'Sahil Bölgesi', slug: 'sahil-bolgesi' },
    ],
    cities: [
      { name: 'Tunis', slug: 'tunis', regionSlug: 'tunis-bolgesi' },
      { name: 'Ariana', slug: 'ariana', regionSlug: 'tunis-bolgesi' },
      { name: 'Sousse', slug: 'sousse', regionSlug: 'sahil-bolgesi' },
      { name: 'Sfax', slug: 'sfax', regionSlug: 'sahil-bolgesi' },
    ],
  },

  // =========================
  // CHINA
  // =========================
  {
    country: {
      name: 'Çin',
      iso2: 'CN',
      iso3: 'CHN',
      slug: 'cin',
      heatZone: 'ZONE5',
      marketZone: null,
      hemisphere: 'NORTHERN',

      salaryMultiplier: '0.850',
      rentMultiplier: '0.900',
      overheadMultiplier: '0.900',
      priceMultiplier: '0.850',
      productionMultiplier: '1.150',
    },
    regions: [
      { name: 'Guangdong', slug: 'guangdong' },
      { name: 'Zhejiang', slug: 'zhejiang' },
    ],
    cities: [
      { name: 'Guangzhou', slug: 'guangzhou', regionSlug: 'guangdong' },
      { name: 'Shenzhen', slug: 'shenzhen', regionSlug: 'guangdong' },
      { name: 'Hangzhou', slug: 'hangzhou', regionSlug: 'zhejiang' },
      { name: 'Ningbo', slug: 'ningbo', regionSlug: 'zhejiang' },
    ],
  },

  // =========================
  // INDIA
  // =========================
  {
    country: {
      name: 'Hindistan',
      iso2: 'IN',
      iso3: 'IND',
      slug: 'hindistan',
      heatZone: 'ZONE7',
      marketZone: null,
      hemisphere: 'NORTHERN',

      salaryMultiplier: '0.800',
      rentMultiplier: '0.850',
      overheadMultiplier: '0.900',
      priceMultiplier: '0.820',
      productionMultiplier: '1.200',
    },
    regions: [
      { name: 'Maharashtra', slug: 'maharashtra' },
      { name: 'Tamil Nadu', slug: 'tamil-nadu' },
    ],
    cities: [
      { name: 'Mumbai', slug: 'mumbai', regionSlug: 'maharashtra' },
      { name: 'Pune', slug: 'pune', regionSlug: 'maharashtra' },
      { name: 'Chennai', slug: 'chennai', regionSlug: 'tamil-nadu' },
      { name: 'Coimbatore', slug: 'coimbatore', regionSlug: 'tamil-nadu' },
    ],
  },

  // =========================
  // BANGLADESH
  // =========================
  {
    country: {
      name: 'Bangladesh',
      iso2: 'BD',
      iso3: 'BGD',
      slug: 'bangladesh',
      heatZone: 'ZONE8',
      marketZone: null,
      hemisphere: 'NORTHERN',

      salaryMultiplier: '0.700',
      rentMultiplier: '0.780',
      overheadMultiplier: '0.850',
      priceMultiplier: '0.750',
      productionMultiplier: '1.300',
    },
    regions: [
      { name: 'Dhaka Bölgesi', slug: 'dhaka-bolgesi' },
      { name: 'Chattogram Bölgesi', slug: 'chattogram-bolgesi' },
    ],
    cities: [
      { name: 'Dhaka', slug: 'dhaka', regionSlug: 'dhaka-bolgesi' },
      { name: 'Gazipur', slug: 'gazipur', regionSlug: 'dhaka-bolgesi' },
      { name: 'Chattogram', slug: 'chattogram', regionSlug: 'chattogram-bolgesi' },
      { name: 'Narayanganj', slug: 'narayanganj', regionSlug: 'dhaka-bolgesi' },
    ],
  },
] as const;

function toDecimal(value: string | number | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(1.0);
  return new Prisma.Decimal(value);
}

/** Map seed hemisphere "NORTHERN" to Prisma enum NORTH */
function toHemisphere(value: string | null | undefined): 'NORTH' | 'SOUTH' | 'EQUATOR' | null {
  if (value === null || value === undefined) return null;
  const v = String(value).toUpperCase();
  if (v === 'NORTHERN' || v === 'NORTH') return 'NORTH';
  if (v === 'SOUTHERN' || v === 'SOUTH') return 'SOUTH';
  if (v === 'EQUATOR') return 'EQUATOR';
  return null;
}

export async function seedProductionCountries(prisma: PrismaClient): Promise<void> {
  for (const item of productionCountriesSeed) {
    const c = item.country;

    const country = await prisma.country.upsert({
      where: { iso2: c.iso2 },
      update: {
        name: c.name,
        iso3: c.iso3,
        slug: c.slug,
        latitude: null,
        longitude: null,
        heatZone: c.heatZone as HeatZone,
        marketZone: null,
        hemisphere: toHemisphere(c.hemisphere),
        salaryMultiplier: toDecimal(c.salaryMultiplier),
        rentMultiplier: toDecimal(c.rentMultiplier),
        overheadMultiplier: toDecimal(c.overheadMultiplier),
        priceMultiplier: toDecimal(c.priceMultiplier),
        productionMultiplier: toDecimal(c.productionMultiplier),
      },
      create: {
        name: c.name,
        iso2: c.iso2,
        iso3: c.iso3,
        slug: c.slug,
        latitude: null,
        longitude: null,
        heatZone: c.heatZone as HeatZone,
        marketZone: null,
        hemisphere: toHemisphere(c.hemisphere),
        salaryMultiplier: toDecimal(c.salaryMultiplier),
        rentMultiplier: toDecimal(c.rentMultiplier),
        overheadMultiplier: toDecimal(c.overheadMultiplier),
        priceMultiplier: toDecimal(c.priceMultiplier),
        productionMultiplier: toDecimal(c.productionMultiplier),
      },
    });

    const regionBySlug = new Map<string, { id: string }>();

    for (const r of item.regions) {
      const region = await prisma.region.upsert({
        where: {
          countryId_slug: { countryId: country.id, slug: r.slug },
        },
        update: { name: r.name, slug: r.slug },
        create: {
          countryId: country.id,
          name: r.name,
          slug: r.slug,
        },
      });
      regionBySlug.set(r.slug, { id: region.id });
    }

    for (const city of item.cities) {
      const regionId = city.regionSlug ? regionBySlug.get(city.regionSlug)?.id ?? null : null;
      await prisma.city.upsert({
        where: {
          countryId_slug: { countryId: country.id, slug: city.slug },
        },
        update: {
          name: city.name,
          slug: city.slug,
          regionId,
          latitude: null,
          longitude: null,
        },
        create: {
          countryId: country.id,
          regionId,
          name: city.name,
          slug: city.slug,
          latitude: null,
          longitude: null,
        },
      });
    }
  }
}

export default seedProductionCountries;
