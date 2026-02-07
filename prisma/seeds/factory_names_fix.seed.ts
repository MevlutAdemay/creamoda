/**
 * factory_names_fix.seed.ts - Regenerate Factory.name deterministically from code + country + city.
 * Removes tabs/multiple spaces. Uses country-specific prefix, group sector, legal suffix (Ltd.Şti. / A.Ş.).
 * Does NOT change Factory.code.
 */

import { PrismaClient, type ManufacturingGroup } from '@prisma/client';

const COUNTRY_PREFIX: Record<string, string[]> = {
  EG: ['Nil', 'Kahire', 'Sina', 'Memfis', 'Lotus', 'Piramid'],
  TN: ['Kartaca', 'Sahara', 'Zeytin', 'Akdeniz', 'Tunus', 'Jasmin'],
  CN: ['Jade', 'Dragon', 'Pearl', 'SilkRoad', 'Lotus', 'Harbor'],
  IN: ['Ganga', 'Indus', 'Lotus', 'Monsoon', 'Spice', 'Ashoka'],
  BD: ['Bengal', 'Padma', 'Sundarban', 'Delta', 'River', 'Chittagong'],
};

const GROUP_SECTOR: Record<ManufacturingGroup, string> = {
  JERSEY: 'Jersey Üretim',
  WOVEN: 'Dokuma Atölye',
  DENIM: 'Denim Works',
  KNITWEAR: 'Triko Atelier',
  OUTERWEAR: 'Outerwear Manufacturing',
  LEATHER: 'Deri Sanayi',
  FOOTWEAR: 'Ayakkabı Sanayi',
  ACCESSORY: 'Aksesuar Üretim',
};

const CORE_NAMES = [
  'Tekstil',
  'Garment',
  'Apparel',
  'Moda',
  'Industrial',
  'Manufacturing',
  'Textiles',
  'Supply',
];

/** Deterministic integer hash from string (same code => same hash). */
function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Clean name: no tabs, no multiple spaces, trim. */
function cleanName(name: string): string {
  return name
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse factory code into iso2, group, index. Returns null if not F-* format. */
function parseCode(
  code: string
): { iso2: string; group: ManufacturingGroup; index: number } | null {
  const match = code.match(/^F-(EG|TN|CN|IN|BD)-(JERSEY|WOVEN|DENIM|KNITWEAR|OUTERWEAR|LEATHER|FOOTWEAR|ACCESSORY)-(\d{2})$/);
  if (!match) return null;
  const [, iso2, group, indexStr] = match;
  return {
    iso2: iso2!,
    group: group as ManufacturingGroup,
    index: parseInt(indexStr!, 10),
  };
}

/** Build deterministic name for a factory. Same code => same name. */
function buildName(
  code: string,
  countryName: string,
  cityName: string | null,
  iso2: string,
  group: ManufacturingGroup
): string {
  const h = stringHash(code);
  const prefixes = COUNTRY_PREFIX[iso2] ?? [countryName];
  const prefix = prefixes[h % prefixes.length];
  const sector = GROUP_SECTOR[group];
  const coreName = CORE_NAMES[h % CORE_NAMES.length];
  const suffix = h % 2 === 0 ? 'San.Tic.Ltd.Şti.' : 'San.Tic.A.Ş.';
  const location = cityName && cityName.trim() ? cityName.trim() : countryName;

  let name = `${prefix} ${sector} ${coreName} ${suffix} - ${location}`;
  if (name.length > 60) {
    const shortSuffix = h % 2 === 0 ? 'Ltd.Şti.' : 'A.Ş.';
    name = `${prefix} ${sector} ${coreName} ${shortSuffix} - ${location}`;
  }
  return cleanName(name);
}

export async function fixFactoryNames(prisma: PrismaClient): Promise<number> {
  const factories = await prisma.factory.findMany({
    where: { code: { startsWith: 'F-' } },
    include: {
      country: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
    },
    orderBy: { code: 'asc' },
  });

  let updated = 0;

  for (const f of factories) {
    const parsed = parseCode(f.code);
    const countryName = f.country?.name ?? 'Unknown';
    const cityName = f.city?.name ?? null;

    let name: string;
    if (parsed) {
      name = buildName(
        f.code,
        countryName,
        cityName,
        parsed.iso2,
        parsed.group
      );
    } else {
      name = `${countryName} - ${cityName ?? countryName}`;
      name = cleanName(name);
    }

    await prisma.factory.update({
      where: { id: f.id },
      data: { name },
    });
    updated++;
  }

  console.log(`Factory names fix: ${updated} factories updated.`);
  return updated;
}

export default fixFactoryNames;
