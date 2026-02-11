//app/lib/game/season-calendar.ts

/**
 * Canonical season + collection calendar for ModaVerse.
 * PURE and DETERMINISTIC (no Prisma, no side effects).
 * cycleKey = primary identifier (DB/logic); label = UI-only, never parsed.
 *
 * @example
 *   const open = getOpenCollectionWindows('2026-05-01', 'NORTH');
 *   const sales = getCurrentSalesSeason('2026-05-01', 'NORTH');
 *   const nextColl = getNextCollectionWindow('2026-05-01', 'NORTH');
 */

export type Hemisphere = 'NORTH' | 'SOUTH';
export type SeasonKey = 'WINTER' | 'SUMMER';
export type SeasonType = 'FW' | 'SS';

/** All valid cycle keys (NORTH + SOUTH). Used in DB snapshot fields. */
export type CollectionKey =
  | 'FW2526' | 'SS26' | 'FW2627' | 'SS27' | 'FW2728' | 'SS28' | 'FW2829' | 'SS29' | 'FW2930' | 'SS30' | 'FW30'
  | 'SS2526' | 'FW26' | 'SS2627' | 'FW27' | 'SS2728' | 'FW28' | 'SS2829' | 'FW29' | 'SS2930';

export interface DateRange {
  startDayKey: string;
  endDayKey: string;
}

/** Collection window: cycleKey is primary; label is UI-only. */
export interface CollectionWindow extends DateRange {
  hemisphere: Hemisphere;
  seasonType: SeasonType;
  cycleKey: string;
  label: string;
}

export interface SalesSeasonWindow extends DateRange {
  hemisphere: Hemisphere;
  season: SeasonKey;
  seasonType: SeasonType;
  cycleKey: string;
  label: string;
}

/** Returned by getCurrentSalesSeason for guidance/rules. */
export interface CurrentSalesSeason {
  seasonType: SeasonType;
  cycleKey: string;
  label: string;
}

export interface CalendarResult<T> {
  current: T;
  next: T;
}

const MIN_DAYKEY = '2025-09-10';
const MAX_DAYKEY = '2030-09-05';

// ---------------------------------------------------------------------------
// SALES — NORTH (exact ranges from spec)
// ---------------------------------------------------------------------------
const SALES_NORTH: SalesSeasonWindow[] = [
  { hemisphere: 'NORTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW2526', label: 'FW-25/26', startDayKey: '2025-09-10', endDayKey: '2026-03-10' },
  { hemisphere: 'NORTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS26', label: 'SS-26', startDayKey: '2026-03-11', endDayKey: '2026-09-05' },
  { hemisphere: 'NORTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW2627', label: 'FW-26/27', startDayKey: '2026-09-06', endDayKey: '2027-03-10' },
  { hemisphere: 'NORTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS27', label: 'SS-27', startDayKey: '2027-03-11', endDayKey: '2027-09-05' },
  { hemisphere: 'NORTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW2728', label: 'FW-27/28', startDayKey: '2027-09-06', endDayKey: '2028-03-10' },
  { hemisphere: 'NORTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS28', label: 'SS-28', startDayKey: '2028-03-11', endDayKey: '2028-09-05' },
  { hemisphere: 'NORTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW2829', label: 'FW-28/29', startDayKey: '2028-09-06', endDayKey: '2029-03-10' },
  { hemisphere: 'NORTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS29', label: 'SS-29', startDayKey: '2029-03-11', endDayKey: '2029-09-05' },
  { hemisphere: 'NORTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW2930', label: 'FW-29/30', startDayKey: '2029-09-06', endDayKey: '2030-03-10' },
  { hemisphere: 'NORTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS30', label: 'SS-30', startDayKey: '2030-03-11', endDayKey: '2030-09-05' },
];

// ---------------------------------------------------------------------------
// SALES — SOUTH
// ---------------------------------------------------------------------------
const SALES_SOUTH: SalesSeasonWindow[] = [
  { hemisphere: 'SOUTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS2526', label: 'SS-25/26', startDayKey: '2025-09-15', endDayKey: '2026-02-28' },
  { hemisphere: 'SOUTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW26', label: 'FW-26', startDayKey: '2026-03-01', endDayKey: '2026-09-02' },
  { hemisphere: 'SOUTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS2627', label: 'SS-26/27', startDayKey: '2026-09-03', endDayKey: '2027-02-28' },
  { hemisphere: 'SOUTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW27', label: 'FW-27', startDayKey: '2027-03-01', endDayKey: '2027-09-02' },
  { hemisphere: 'SOUTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS2728', label: 'SS-27/28', startDayKey: '2027-09-03', endDayKey: '2028-02-28' },
  { hemisphere: 'SOUTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW28', label: 'FW-28', startDayKey: '2028-03-01', endDayKey: '2028-09-02' },
  { hemisphere: 'SOUTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS2829', label: 'SS-28/29', startDayKey: '2028-09-03', endDayKey: '2029-02-28' },
  { hemisphere: 'SOUTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW29', label: 'FW-29', startDayKey: '2029-03-01', endDayKey: '2029-09-02' },
  { hemisphere: 'SOUTH', season: 'SUMMER', seasonType: 'SS', cycleKey: 'SS2930', label: 'SS-29/30', startDayKey: '2029-09-03', endDayKey: '2030-02-28' },
  { hemisphere: 'SOUTH', season: 'WINTER', seasonType: 'FW', cycleKey: 'FW30', label: 'FW-30', startDayKey: '2030-03-01', endDayKey: '2030-09-02' },
];

// ---------------------------------------------------------------------------
// COLLECTION — NORTH (product snapshot windows; overlapping is valid)
// ---------------------------------------------------------------------------
const COLLECTION_NORTH: CollectionWindow[] = [
  { hemisphere: 'NORTH', seasonType: 'FW', cycleKey: 'FW2526', label: 'FW-25/26', startDayKey: '2025-09-10', endDayKey: '2026-02-25' },
  { hemisphere: 'NORTH', seasonType: 'SS', cycleKey: 'SS26', label: 'SS-26', startDayKey: '2025-10-01', endDayKey: '2026-08-25' },
  { hemisphere: 'NORTH', seasonType: 'FW', cycleKey: 'FW2627', label: 'FW-26/27', startDayKey: '2026-04-01', endDayKey: '2027-02-25' },
  { hemisphere: 'NORTH', seasonType: 'SS', cycleKey: 'SS27', label: 'SS-27', startDayKey: '2026-10-01', endDayKey: '2027-08-25' },
  { hemisphere: 'NORTH', seasonType: 'FW', cycleKey: 'FW2728', label: 'FW-27/28', startDayKey: '2027-04-01', endDayKey: '2028-02-25' },
  { hemisphere: 'NORTH', seasonType: 'SS', cycleKey: 'SS28', label: 'SS-28', startDayKey: '2027-10-01', endDayKey: '2028-08-25' },
  { hemisphere: 'NORTH', seasonType: 'FW', cycleKey: 'FW2829', label: 'FW-28/29', startDayKey: '2028-04-01', endDayKey: '2029-02-25' },
  { hemisphere: 'NORTH', seasonType: 'SS', cycleKey: 'SS29', label: 'SS-29', startDayKey: '2028-10-01', endDayKey: '2029-08-25' },
  { hemisphere: 'NORTH', seasonType: 'FW', cycleKey: 'FW2930', label: 'FW-29/30', startDayKey: '2029-04-01', endDayKey: '2030-02-25' },
  { hemisphere: 'NORTH', seasonType: 'SS', cycleKey: 'SS30', label: 'SS-30', startDayKey: '2029-10-01', endDayKey: '2030-08-25' },
];

// ---------------------------------------------------------------------------
// COLLECTION — SOUTH
// ---------------------------------------------------------------------------
const COLLECTION_SOUTH: CollectionWindow[] = [
  { hemisphere: 'SOUTH', seasonType: 'SS', cycleKey: 'SS2526', label: 'SS-25/26', startDayKey: '2025-09-10', endDayKey: '2026-02-20' },
  { hemisphere: 'SOUTH', seasonType: 'FW', cycleKey: 'FW26', label: 'FW-26', startDayKey: '2025-10-05', endDayKey: '2026-08-15' },
  { hemisphere: 'SOUTH', seasonType: 'SS', cycleKey: 'SS2627', label: 'SS-26/27', startDayKey: '2026-04-10', endDayKey: '2027-02-20' },
  { hemisphere: 'SOUTH', seasonType: 'FW', cycleKey: 'FW27', label: 'FW-27', startDayKey: '2026-10-05', endDayKey: '2027-08-15' },
  { hemisphere: 'SOUTH', seasonType: 'SS', cycleKey: 'SS2728', label: 'SS-27/28', startDayKey: '2027-04-10', endDayKey: '2028-02-20' },
  { hemisphere: 'SOUTH', seasonType: 'FW', cycleKey: 'FW28', label: 'FW-28', startDayKey: '2027-10-05', endDayKey: '2028-08-15' },
  { hemisphere: 'SOUTH', seasonType: 'SS', cycleKey: 'SS2829', label: 'SS-28/29', startDayKey: '2028-04-10', endDayKey: '2029-02-20' },
  { hemisphere: 'SOUTH', seasonType: 'FW', cycleKey: 'FW29', label: 'FW-29', startDayKey: '2028-10-05', endDayKey: '2029-08-15' },
  { hemisphere: 'SOUTH', seasonType: 'SS', cycleKey: 'SS2930', label: 'SS-29/30', startDayKey: '2029-04-10', endDayKey: '2030-02-20' },
  { hemisphere: 'SOUTH', seasonType: 'FW', cycleKey: 'FW30', label: 'FW-30', startDayKey: '2029-10-05', endDayKey: '2030-08-15' },
];

const SALES_WINDOWS: Record<Hemisphere, SalesSeasonWindow[]> = {
  NORTH: SALES_NORTH,
  SOUTH: SALES_SOUTH,
};

const COLLECTION_WINDOWS: Record<Hemisphere, CollectionWindow[]> = {
  NORTH: COLLECTION_NORTH,
  SOUTH: COLLECTION_SOUTH,
};

// ---------------------------------------------------------------------------
// Parsing and normalization
// ---------------------------------------------------------------------------

/**
 * Parse dayKey from Date or ISO "YYYY-MM-DD" string; return normalized "YYYY-MM-DD" at UTC midnight.
 */
export function parseDayKey(dayKey: Date | string): string {
  if (typeof dayKey === 'string') {
    const trimmed = dayKey.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) {
      throw new Error(`season-calendar: invalid dayKey string "${dayKey}". Use YYYY-MM-DD.`);
    }
    const [, y, m, d] = match;
    const yNum = parseInt(y!, 10);
    const mNum = parseInt(m!, 10) - 1;
    const dNum = parseInt(d!, 10);
    if (mNum < 0 || mNum > 11 || dNum < 1 || dNum > 31) {
      throw new Error(`season-calendar: invalid date parts in "${dayKey}".`);
    }
    const date = new Date(Date.UTC(yNum, mNum, dNum, 0, 0, 0, 0));
    if (date.getUTCDate() !== dNum || date.getUTCMonth() !== mNum || date.getUTCFullYear() !== yNum) {
      throw new Error(`season-calendar: invalid date "${dayKey}".`);
    }
    return trimmed;
  }
  const d = dayKey;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new Error('season-calendar: dayKey must be a valid Date or YYYY-MM-DD string.');
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Inclusive: start <= dayKey <= end (YYYY-MM-DD lexicographic compare is safe).
 */
export function isWithinRange(dayKey: string, rangeStart: string, rangeEnd: string): boolean {
  return dayKey >= rangeStart && dayKey <= rangeEnd;
}

function isInSupportedRange(dayKeyStr: string): boolean {
  return dayKeyStr >= MIN_DAYKEY && dayKeyStr <= MAX_DAYKEY;
}

function findCurrentWindow<T extends DateRange>(windows: T[], dayKeyStr: string): T | null {
  if (!isInSupportedRange(dayKeyStr)) return null;
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!;
    if (isWithinRange(dayKeyStr, w.startDayKey, w.endDayKey)) return w;
  }
  return null;
}

function findCurrentAndNext<T extends DateRange>(
  windows: T[],
  dayKeyStr: string,
  strict: boolean
): CalendarResult<T> | null {
  if (!isInSupportedRange(dayKeyStr)) {
    if (strict) {
      throw new Error(
        `season-calendar: dayKey ${dayKeyStr} is outside supported range ${MIN_DAYKEY}..${MAX_DAYKEY}.`
      );
    }
    return null;
  }

  let currentIndex = -1;
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!;
    if (isWithinRange(dayKeyStr, w.startDayKey, w.endDayKey)) {
      currentIndex = i;
      break;
    }
  }

  if (currentIndex === -1) {
    if (strict) {
      throw new Error(`season-calendar: dayKey ${dayKeyStr} falls in no window (gap in calendar).`);
    }
    return null;
  }

  const current = windows[currentIndex]!;
  const nextIndex = currentIndex + 1;
  if (nextIndex >= windows.length) {
    if (strict) {
      const label = 'label' in current ? String(current.label) : current.startDayKey;
      throw new Error(`season-calendar: no next window after ${label} for dayKey ${dayKeyStr}.`);
    }
    return null;
  }

  const next = windows[nextIndex]!;
  return { current, next };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CalendarOptions {
  strict?: boolean;
}

/**
 * Returns current and next SALES season windows for the given dayKey and hemisphere.
 */
export function getSalesSeasonWindow(
  dayKey: Date | string,
  hemisphere: Hemisphere,
  opts?: CalendarOptions
): CalendarResult<SalesSeasonWindow> | null {
  const strict = opts?.strict ?? true;
  const dayKeyStr = parseDayKey(dayKey);
  return findCurrentAndNext(SALES_WINDOWS[hemisphere], dayKeyStr, strict);
}

/**
 * Returns current and next COLLECTION cycle windows for the given dayKey and hemisphere.
 */
export function getCollectionWindow(
  dayKey: Date | string,
  hemisphere: Hemisphere,
  opts?: CalendarOptions
): CalendarResult<CollectionWindow> | null {
  const strict = opts?.strict ?? true;
  const dayKeyStr = parseDayKey(dayKey);
  return findCurrentAndNext(COLLECTION_WINDOWS[hemisphere], dayKeyStr, strict);
}

/**
 * Current ACTIVE SALES season window for the given dayKey and hemisphere.
 * Returns the full SalesSeasonWindow where startDayKey <= dayKey <= endDayKey, or null.
 */
export function getCurrentSalesSeason(
  dayKey: string,
  hemisphere: Hemisphere
): SalesSeasonWindow | null {
  const dayKeyStr = typeof dayKey === 'string' ? dayKey : parseDayKey(dayKey);
  if (!isInSupportedRange(dayKeyStr)) return null;
  return findCurrentWindow(SALES_WINDOWS[hemisphere], dayKeyStr);
}

/**
 * Next COLLECTION window whose startDayKey is strictly after dayKey (first upcoming).
 * Returns null if no such window (e.g. dayKey is in or past the last window).
 */
export function getNextCollectionWindow(
  dayKey: string,
  hemisphere: Hemisphere
): CollectionWindow | null {
  const dayKeyStr = typeof dayKey === 'string' ? dayKey : parseDayKey(dayKey);
  if (!isInSupportedRange(dayKeyStr)) return null;
  const windows = COLLECTION_WINDOWS[hemisphere];
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!;
    if (w.startDayKey > dayKeyStr) return w;
  }
  return null;
}

/**
 * Returns only the current SALES season window (no next). Use when dayKey may be in the last window.
 */
export function getCurrentSalesWindow(
  dayKey: Date | string,
  hemisphere: Hemisphere
): SalesSeasonWindow | null {
  const dayKeyStr = parseDayKey(dayKey);
  return findCurrentWindow(SALES_WINDOWS[hemisphere], dayKeyStr);
}

/**
 * Returns only the current COLLECTION window (no next). Use when dayKey may be in the last window.
 */
export function getCurrentCollectionWindow(
  dayKey: Date | string,
  hemisphere: Hemisphere
): CollectionWindow | null {
  const dayKeyStr = parseDayKey(dayKey);
  return findCurrentWindow(COLLECTION_WINDOWS[hemisphere], dayKeyStr);
}

/**
 * Returns ALL collection windows where startDayKey <= dayKey <= endDayKey (inclusive).
 * Overlapping windows are valid (e.g. FW sales while SS planning); can return 1 or 2.
 */
export function getOpenCollectionWindows(
  dayKey: string,
  hemisphere: Hemisphere
): CollectionWindow[] {
  const dayKeyStr = typeof dayKey === 'string' ? dayKey : parseDayKey(dayKey);
  if (!isInSupportedRange(dayKeyStr)) return [];
  const windows = COLLECTION_WINDOWS[hemisphere];
  return windows.filter((w) => isWithinRange(dayKeyStr, w.startDayKey, w.endDayKey));
}

/**
 * Thin wrapper: active SALES season key (WINTER or SUMMER) for the given dayKey and hemisphere.
 */
export function getActiveSeasonKey(dayKey: Date | string, hemisphere: Hemisphere): SeasonKey {
  const dayKeyStr = parseDayKey(dayKey);
  if (!isInSupportedRange(dayKeyStr)) {
    throw new Error(
      `season-calendar: dayKey ${dayKeyStr} is outside supported range ${MIN_DAYKEY}..${MAX_DAYKEY}.`
    );
  }
  const current = findCurrentWindow(SALES_WINDOWS[hemisphere], dayKeyStr);
  if (!current) {
    throw new Error(`season-calendar: dayKey ${dayKeyStr} falls in no sales window (${hemisphere}).`);
  }
  return current.season;
}

/**
 * Current COLLECTION cycle label for the given dayKey and hemisphere (e.g. "FW-25/26", "SS-26").
 * Returns empty string if dayKey is outside range or in a gap.
 */
export function getCurrentCollectionLabel(dayKey: Date | string, hemisphere: Hemisphere): string {
  try {
    const dayKeyStr = parseDayKey(dayKey);
    const result = getCollectionWindow(dayKeyStr, hemisphere, { strict: false });
    return result ? result.current.label : '';
  } catch {
    return '';
  }
}

/**
 * Returns the collection snapshot (cycleKey, label) for a product added on dayKey in the given hemisphere.
 * Used when creating PlayerProduct: only WINTER | SUMMER; ALL is handled by caller (null).
 * Picks the open window matching productSeason (WINTER→FW, SUMMER→SS); if multiple open, first by startDayKey.
 */
export function getCollectionSnapshotForProduct(
  dayKey: string,
  hemisphere: Hemisphere,
  productSeason: SeasonKey
): { cycleKey: string; label: string } | null {
  const dayKeyStr = typeof dayKey === 'string' ? dayKey : parseDayKey(dayKey);
  const seasonType: SeasonType = productSeason === 'WINTER' ? 'FW' : 'SS';
  const open = getOpenCollectionWindows(dayKeyStr, hemisphere);
  const matching = open.filter((w) => w.seasonType === seasonType);
  if (matching.length === 0) return null;
  matching.sort((a, b) => a.startDayKey.localeCompare(b.startDayKey));
  const w = matching[0]!;
  return { cycleKey: w.cycleKey, label: w.label };
}

// ---------------------------------------------------------------------------
// Validation (for dev / tests)
// ---------------------------------------------------------------------------

/**
 * Validates calendar data: start <= end, sorted by startDayKey; no overlap for SALES only.
 * Call in dev or from tests.
 */
export function validateCalendar(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  function checkWindows<T extends DateRange>(
    list: T[],
    name: string,
    getLabel: (w: T) => string,
    checkOverlap: boolean
  ): void {
    for (let i = 0; i < list.length; i++) {
      const w = list[i]!;
      if (w.startDayKey > w.endDayKey) {
        errors.push(`${name}[${i}]: startDayKey > endDayKey (${getLabel(w)})`);
      }
      if (i > 0) {
        const prev = list[i - 1]!;
        if (prev.startDayKey > w.startDayKey) {
          errors.push(`${name}: not sorted by startDayKey at index ${i} (${getLabel(prev)} vs ${getLabel(w)})`);
        }
        if (checkOverlap && prev.endDayKey >= w.startDayKey) {
          errors.push(`${name}: overlap between ${getLabel(prev)} and ${getLabel(w)}`);
        }
      }
    }
  }

  checkWindows(SALES_NORTH, 'SALES_NORTH', (w) => w.label, true);
  checkWindows(SALES_SOUTH, 'SALES_SOUTH', (w) => w.label, true);
  checkWindows(COLLECTION_NORTH, 'COLLECTION_NORTH', (w) => w.label, false);
  checkWindows(COLLECTION_SOUTH, 'COLLECTION_SOUTH', (w) => w.label, false);

  return {
    valid: errors.length === 0,
    errors,
  };
}
