// lib/game/game-clock.ts


/**
 * Game Clock Utilities
 * 
 * Server-side utilities for accessing CompanyGameClock.
 * Single source of truth for dayKey normalization and game start date.
 */

import prisma from '@/lib/prisma';

/**
 * Default game start date: 2025-09-10 UTC midnight
 * All new companies start on this date in-game.
 */
export const DEFAULT_GAME_START_DATE = new Date('2025-09-10T00:00:00.000Z');

/**
 * Normalizes any date to UTC midnight (00:00:00.000Z).
 * Use this EVERYWHERE a dayKey is created or compared.
 * 
 * @param date - Date to normalize
 * @returns Date at UTC midnight
 */
export function normalizeUtcMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Format a date to YYYY-MM-DD string (UTC)
 * 
 * @param date - Date to format
 * @returns String in YYYY-MM-DD format
 */
export function formatDayKeyString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse a YYYY-MM-DD string to UTC Date (midnight UTC)
 * 
 * @param dayKeyStr - String in YYYY-MM-DD format
 * @returns Date at UTC midnight
 */
export function parseDayKeyString(dayKeyStr: string): Date {
  return new Date(`${dayKeyStr}T00:00:00.000Z`);
}

/**
 * Gets the company's current game day key (UTC midnight).
 * If the clock doesn't exist, creates one with DEFAULT_GAME_START_DATE.
 * 
 * @param companyId - The company ID
 * @returns The current game day key as a Date (UTC midnight)
 */
export async function getCompanyGameDayKey(companyId: string): Promise<Date> {
  const gameClock = await prisma.companyGameClock.findUnique({
    where: { companyId },
    select: { currentDayKey: true },
  });

  if (gameClock) {
    return normalizeUtcMidnight(gameClock.currentDayKey);
  }

  // Clock doesn't exist - create it with default start date
  const created = await prisma.companyGameClock.create({
    data: {
      companyId,
      currentDayKey: DEFAULT_GAME_START_DATE,
      startedAtDayKey: DEFAULT_GAME_START_DATE,
      isPaused: false,
    },
  });

  return normalizeUtcMidnight(created.currentDayKey);
}

/**
 * Gets the company's game clock data including current day key and started at.
 * If the clock doesn't exist, creates one with DEFAULT_GAME_START_DATE.
 * 
 * @param companyId - The company ID
 * @returns Game clock data
 */
export async function getCompanyGameClock(companyId: string): Promise<{
  currentDayKey: Date;
  startedAtDayKey: Date;
  isPaused: boolean;
  version: number;
}> {
  let gameClock = await prisma.companyGameClock.findUnique({
    where: { companyId },
    select: {
      currentDayKey: true,
      startedAtDayKey: true,
      isPaused: true,
      version: true,
    },
  });

  if (!gameClock) {
    // Clock doesn't exist - create it with default start date
    gameClock = await prisma.companyGameClock.create({
      data: {
        companyId,
        currentDayKey: DEFAULT_GAME_START_DATE,
        startedAtDayKey: DEFAULT_GAME_START_DATE,
        isPaused: false,
      },
      select: {
        currentDayKey: true,
        startedAtDayKey: true,
        isPaused: true,
        version: true,
      },
    });
  }

  return {
    currentDayKey: normalizeUtcMidnight(gameClock.currentDayKey),
    startedAtDayKey: normalizeUtcMidnight(gameClock.startedAtDayKey),
    isPaused: gameClock.isPaused,
    version: gameClock.version,
  };
}

/**
 * Get the next due date for a specific day of month, based on game date.
 * If today's UTC date <= dayOfMonth: returns this month's dayOfMonth
 * Else: returns next month's dayOfMonth
 * Always normalized to UTC midnight (00:00:00.000 UTC)
 * 
 * @param dayOfMonth - Day of month (1-31)
 * @param referenceDate - Reference date (usually game's current day)
 * @returns Next due date at UTC midnight
 */
export function getNextDueDate(dayOfMonth: number, referenceDate: Date = new Date()): Date {
  const currentDay = referenceDate.getUTCDate();
  const currentMonth = referenceDate.getUTCMonth();
  const currentYear = referenceDate.getUTCFullYear();

  let dueYear = currentYear;
  let dueMonth = currentMonth;

  if (currentDay > dayOfMonth) {
    // Next month
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  // Create date at UTC midnight
  return new Date(Date.UTC(dueYear, dueMonth, dayOfMonth, 0, 0, 0, 0));
}

/**
 * Get cycle key in YYYY-MM format from a date (using UTC)
 * 
 * @param date - Date to get cycle key from
 * @returns Cycle key in YYYY-MM format
 */
export function getCycleKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Settlement period definition (strict, UTC midnight).
 * Payout on 5th covers: previous month 20th (inclusive) -> current month 4th (inclusive).
 * Payout on 20th covers: current month 5th (inclusive) -> current month 19th (inclusive).
 *
 * @param payoutDayKey - UTC midnight date; must be 5th or 20th of month
 * @returns { periodStartDayKey, periodEndDayKey } at UTC midnight, or null if invalid
 */
export function getPeriodForPayoutDayKey(payoutDayKey: Date): {
  periodStartDayKey: Date;
  periodEndDayKey: Date;
} | null {
  const normalized = normalizeUtcMidnight(payoutDayKey);
  const day = normalized.getUTCDate();
  const month = normalized.getUTCMonth();
  const year = normalized.getUTCFullYear();

  if (day === 5) {
    // Period: previous month 20th (incl) -> current month 4th (incl)
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return {
      periodStartDayKey: new Date(Date.UTC(prevYear, prevMonth, 20, 0, 0, 0, 0)),
      periodEndDayKey: new Date(Date.UTC(year, month, 4, 0, 0, 0, 0)),
    };
  }
  if (day === 20) {
    // Period: current month 5th (incl) -> current month 19th (incl)
    return {
      periodStartDayKey: new Date(Date.UTC(year, month, 5, 0, 0, 0, 0)),
      periodEndDayKey: new Date(Date.UTC(year, month, 19, 0, 0, 0, 0)),
    };
  }
  return null;
}

/**
 * Returns true if the given dayKey (UTC midnight) is a settlement payout day (5th or 20th).
 */
export function isPayoutDay(dayKey: Date): boolean {
  const normalized = normalizeUtcMidnight(dayKey);
  const day = normalized.getUTCDate();
  return day === 5 || day === 20;
}

/**
 * Returns true if the given dayKey is a payout day for this company (from FinanceScheduleConfig, fallback 5/20).
 */
export async function isPayoutDayForCompany(companyId: string, dayKey: Date): Promise<boolean> {
  const schedule = await prisma.financeScheduleConfig.findUnique({
    where: { companyId },
    select: { payoutDayOfMonth1: true, payoutDayOfMonth2: true },
  });
  const normalized = normalizeUtcMidnight(dayKey);
  const day = normalized.getUTCDate();
  const d1 = schedule?.payoutDayOfMonth1 ?? 5;
  const d2 = schedule?.payoutDayOfMonth2 ?? 20;
  return day === d1 || day === d2;
}
