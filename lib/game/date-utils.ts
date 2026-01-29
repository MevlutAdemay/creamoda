/**
 * UTC date helpers for season/week calculations.
 * Use UTC consistently for game day and week indexing.
 */

/** Day of year 1..366 (UTC). */
export function getUtcDayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const cur = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((cur - start) / 86400000) + 1;
}

/** Week index 1..52 from day-of-year. weekIndex = min(floor((doy-1)/7)+1, 52). */
export function getWeekIndexFromDayOfYear(doy: number): number {
  const w = Math.floor((doy - 1) / 7) + 1;
  return Math.min(Math.max(1, w), 52);
}

/** Add N months to a date (UTC). */
export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
