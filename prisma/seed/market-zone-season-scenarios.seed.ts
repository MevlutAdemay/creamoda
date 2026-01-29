/**
 * Seed SeasonScenarioDefinition + MarketZoneSeasonScenario from Excel (prisma/seed_data/seasonality/SeasonScope.xlsx).
 * Excel is the source of truth. Two-table write: definition (by code) then curve (by definitionId + marketZone).
 */

import { PrismaClient, MarketZone, ProductSeason } from '@prisma/client';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_MARKET_ZONES = new Set<string>(Object.values(MarketZone));
const VALID_SEASONS = new Set<string>(Object.values(ProductSeason));
const VALID_TIMING = new Set<string>(['EARLY', 'CORE', 'LATE']);
const VALID_VARIANTS = new Set<string>(['A', 'B', 'C']);

/** Normalize week header to W01..W52 for index 0..51 */
function weekHeaderToIndex(key: string): number | null {
  const k = String(key).trim().toUpperCase();
  const m = k.match(/^W0?(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n >= 1 && n <= 52) return n - 1;
  return null;
}

/** Header alias: normalized (lowercase, no spaces) -> canonical key. */
const HEADER_ALIASES: Record<string, string> = {
  marketzone: 'marketZone',
  market_zone: 'marketZone',
  productseason: 'season',
  product_season: 'season',
  season: 'season',
  seasontiming: 'timing',
  season_timing: 'timing',
  timing: 'timing',
  scenariovariant: 'variant',
  scenario_variant: 'variant',
  variant: 'variant',
  name: 'name',
  note: 'note',
  code: 'code',
};

const CANONICAL_KEYS = ['marketZone', 'season', 'timing', 'variant', 'name', 'note', 'code'] as const;

/** Normalize header for alias lookup: trim, lowercase, replace spaces with underscore */
function normalizeHeaderForAlias(h: string): string {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

/** Build header map: canonical keys (and aliases) -> column index. Supports Excel headers like MarketZone, ProductSeason, etc. */
function buildHeaderMap(headers: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => {
    const raw = String(h ?? '').trim();
    if (!raw) return;
    const normalized = normalizeHeaderForAlias(raw);
    const canonical = HEADER_ALIASES[normalized];
    if (canonical) {
      map.set(canonical, i);
      map.set(normalized, i);
    }
    map.set(raw, i);
    map.set(raw.toLowerCase(), i);
  });
  return map;
}

function getCell(row: unknown[], headerMap: Map<string, number>, ...keys: string[]): unknown {
  for (const key of keys) {
    const idx = headerMap.get(key.toLowerCase()) ?? headerMap.get(key);
    if (idx === undefined) continue;
    const val = row[idx];
    if (val !== undefined && val !== null && String(val).trim() !== '') return val;
  }
  return undefined;
}

function getString(row: unknown[], headerMap: Map<string, number>, ...keys: string[]): string {
  const v = getCell(row, headerMap, ...keys);
  if (v == null) return '';
  return String(v).trim();
}

/** Slug: lowercase, Turkish chars, non-alphanumeric -> underscore, collapse, trim, max 60 chars */
function slug(name: string, maxLength = 60): string {
  const tr: Record<string, string> = {
    ş: 's', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', ç: 'c',
    Ş: 's', Ğ: 'g', İ: 'i', Ö: 'o', Ü: 'u', Ç: 'c',
  };
  let s = name.toLowerCase();
  for (const [from, to] of Object.entries(tr)) s = s.split(from).join(to);
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return s.slice(0, maxLength);
}

/** Generate definition code: season_timing_variant_slug, max 80 chars (for SeasonScenarioDefinition) */
function generateDefinitionCode(
  season: string,
  timing: string | null,
  variant: string,
  name: string
): string {
  const timingPart = timing ?? 'NA';
  const slugPart = slug(name, 60);
  const code = `${season}_${timingPart}_${variant}_${slugPart}`;
  return code.length > 80 ? `${code.slice(0, 77)}...` : code;
}

function fail(rowIndex: number, column: string, message: string): never {
  throw new Error(
    `Row ${rowIndex + 1} (${column}): ${message}. Check Excel: header row must be first; column names: marketZone, season, timing, variant, name, note, W01..W52.`
  );
}

export async function seedMarketZoneSeasonScenarios(prisma: PrismaClient): Promise<void> {
  const baseDir = join(process.cwd(), 'prisma', 'seed_data', 'seasonality');
  const path = join(baseDir, 'SeasonScope.xlsx');
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch (e) {
    const alt = join(baseDir, 'SeasonScoope.xlsx');
    try {
      buf = readFileSync(alt);
    } catch {
      throw new Error(`MarketZoneSeasonScenario seed: Excel not found at ${path} or ${alt}. ${e}`);
    }
  }

  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: false });
  const sheetNames = workbook.SheetNames;
  let headerRow: unknown[] = [];
  const allRows: unknown[][] = [];

  for (let s = 0; s < sheetNames.length; s++) {
    const sheet = workbook.Sheets[sheetNames[s]];
    if (!sheet) continue;
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][];
    if (data.length < 2) continue;
    if (s === 0) {
      headerRow = (data[0] as unknown[]).map((c) => (c != null ? String(c).trim() : ''));
    }
    const dataRows = data.slice(1);
    dataRows.forEach((row) => allRows.push(row));
  }

  if (headerRow.length === 0 || allRows.length === 0) {
    console.log('   No data rows in MarketZoneSeasonScenario Excel; skipping.');
    return;
  }

  const headerMap = buildHeaderMap(headerRow);

  const detectedHeaders: Record<string, number> = {};
  CANONICAL_KEYS.forEach((key) => {
    const idx = headerMap.get(key);
    if (idx !== undefined) detectedHeaders[key] = idx;
  });
  console.log('   Detected headers (canonical -> col index):', JSON.stringify(detectedHeaders));

  const weekCols: (number | undefined)[] = new Array(52);
  for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
    const key = String(headerRow[colIdx] ?? '').trim();
    const wi = weekHeaderToIndex(key);
    if (wi !== null) weekCols[wi] = colIdx;
  }
  for (let w = 0; w < 52; w++) {
    if (weekCols[w] === undefined) {
      throw new Error(`Missing week column W${String(w + 1).padStart(2, '0')} in Excel header.`);
    }
  }

  let definitionsCreated = 0;
  let definitionsUpdated = 0;
  let curvesCreated = 0;
  let curvesUpdated = 0;
  let skipped = 0;

  for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
    const row = allRows[rowIndex] as unknown[];
    const isEmpty = row.every((c) => c === undefined || c === null || String(c).trim() === '');
    if (isEmpty) {
      skipped++;
      continue;
    }

    const marketZoneRaw = getString(row, headerMap, 'marketZone');
    const seasonRaw = getString(row, headerMap, 'season');
    const timingRaw = getString(row, headerMap, 'timing');
    const variantRaw = getString(row, headerMap, 'variant');
    const nameRaw = getString(row, headerMap, 'name');
    const noteRaw = getString(row, headerMap, 'note');
    const codeRaw = getString(row, headerMap, 'code');

    if (!marketZoneRaw || !seasonRaw) {
      skipped++;
      if (skipped === 1) {
        console.warn('   Skipping row(s) with missing required field (marketZone or season). Detected headers above.');
      }
      continue;
    }
    if (!VALID_MARKET_ZONES.has(marketZoneRaw)) {
      fail(rowIndex, 'marketZone', `invalid; must be one of: ${[...VALID_MARKET_ZONES].join(', ')}`);
    }
    const marketZone = marketZoneRaw as MarketZone;

    if (!VALID_SEASONS.has(seasonRaw)) {
      fail(rowIndex, 'season', `invalid; must be WINTER, SUMMER, or ALL`);
    }
    const season = seasonRaw as ProductSeason;

    let timing: 'EARLY' | 'CORE' | 'LATE' | null = null;
    if (season === 'ALL') {
      if (timingRaw) fail(rowIndex, 'timing', 'must be empty when season is ALL');
    } else {
      if (!timingRaw) fail(rowIndex, 'timing', 'required when season is WINTER or SUMMER');
      if (!VALID_TIMING.has(timingRaw)) {
        fail(rowIndex, 'timing', `invalid; must be EARLY, CORE, or LATE`);
      }
      timing = timingRaw as 'EARLY' | 'CORE' | 'LATE';
    }

    if (!variantRaw) fail(rowIndex, 'variant', 'required');
    if (!VALID_VARIANTS.has(variantRaw)) {
      fail(rowIndex, 'variant', `invalid; must be A, B, or C`);
    }
    const variant = variantRaw as 'A' | 'B' | 'C';

    if (!nameRaw) fail(rowIndex, 'name', 'required');
    const name = nameRaw;
    const note = noteRaw || null;

    const weeksJson: number[] = [];
    for (let w = 0; w < 52; w++) {
      const colIdx = weekCols[w] as number;
      const val = row[colIdx];
      if (val === undefined || val === null || val === '') {
        fail(rowIndex, `W${String(w + 1).padStart(2, '0')}`, 'missing');
      }
      const num = Number(val);
      if (!Number.isInteger(num)) fail(rowIndex, `W${String(w + 1).padStart(2, '0')}`, 'must be integer');
      if (num < 0 || num > 100) fail(rowIndex, `W${String(w + 1).padStart(2, '0')}`, 'must be 0..100');
      weeksJson.push(num);
    }

    const definitionCode = codeRaw || generateDefinitionCode(season, timing, variant, name);
    const definitionCodeFinal = definitionCode.length > 80 ? `${definitionCode.slice(0, 77)}...` : definitionCode;

    // Prisma client: run `npx prisma generate` so these models exist on PrismaClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defRepo = (prisma as any).seasonScenarioDefinition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const curveRepo = (prisma as any).marketZoneSeasonScenario;

    // 1) Upsert SeasonScenarioDefinition by code
    const existingDef = await defRepo.findUnique({
      where: { code: definitionCodeFinal },
    });
    let definitionId: string;
    if (existingDef) {
      await defRepo.update({
        where: { id: existingDef.id },
        data: { name, note, season, timing, variant, isActive: true },
      });
      definitionId = existingDef.id;
      definitionsUpdated++;
    } else {
      const created = await defRepo.create({
        data: {
          code: definitionCodeFinal,
          name,
          note,
          season,
          timing,
          variant,
          isActive: true,
        },
      });
      definitionId = created.id;
      definitionsCreated++;
    }

    // 2) Upsert MarketZoneSeasonScenario by (definitionId, marketZone)
    const existingCurve = await curveRepo.findUnique({
      where: {
        definitionId_marketZone: { definitionId, marketZone },
      },
    });
    if (existingCurve) {
      await curveRepo.update({
        where: { id: existingCurve.id },
        data: { weeksJson, isActive: true },
      });
      curvesUpdated++;
    } else {
      await curveRepo.create({
        data: {
          definitionId,
          marketZone,
          weeksJson,
          isActive: true,
        },
      });
      curvesCreated++;
    }
  }

  console.log(
    '   ✓ SeasonScenarioDefinition: created=%d, updated=%d',
    definitionsCreated,
    definitionsUpdated
  );
  console.log(
    '   ✓ MarketZoneSeasonScenario: created=%d, updated=%d, skipped=%d',
    curvesCreated,
    curvesUpdated,
    skipped
  );
}
