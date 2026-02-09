/**
 * Pure rule engine for collection-related guidance messages.
 * No Prisma; used by the guidance tick API.
 *
 * Sanity: For NORTH, next SS-26 starts 2025-10-01.
 * - dayKey 2025-09-26 -> daysUntilNextStart === 5 -> UPCOMING_5D.
 * - dayKey 2025-10-01 -> daysUntilNextStart === 0 -> START_TODAY.
 * - dayKey 2025-10-08 -> daysSinceNextStart === 7 -> REMINDER_7D.
 */

import type { CollectionWindow } from './season-calendar';
import type { Hemisphere } from './season-calendar';

const MS_PER_DAY = 86400000;

export interface GuidanceMessageDraft {
  dedupeKey: string;
  title: string;
  body: string;
  ctaHref: string;
  kind?: string;
  level?: string;
  category?: string;
}

/**
 * Days from a to b (UTC midnight). Positive when b is after a.
 * Example: diffDaysDayKey('2025-09-26', '2025-10-01') === 5
 */
export function diffDaysDayKey(a: string, b: string): number {
  const tA = new Date(`${a}T00:00:00.000Z`).getTime();
  const tB = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((tB - tA) / MS_PER_DAY);
}

export interface BuildCollectionGuidanceParams {
  dayKey: string;
  hemisphere: Hemisphere;
  nextWin: CollectionWindow;
  productCountNext: number;
}

/**
 * Builds 0–3 collection guidance drafts based on calendar and product count.
 * Only generates when productCountNext === 0 (user has no products in next window).
 */
export function buildCollectionGuidance(params: BuildCollectionGuidanceParams): GuidanceMessageDraft[] {
  const { dayKey, hemisphere, nextWin, productCountNext } = params;
  const drafts: GuidanceMessageDraft[] = [];

  if (productCountNext > 0) return drafts;

  const daysUntilNextStart = diffDaysDayKey(dayKey, nextWin.startDayKey);
  const daysSinceNextStart = diffDaysDayKey(nextWin.startDayKey, dayKey);

  // UPCOMING_5D: 5 days before next collection starts
  if (daysUntilNextStart === 5) {
    drafts.push({
      dedupeKey: `GUIDE:COLL:UPCOMING_5D:${hemisphere}:${nextWin.label}`,
      title: 'Next collection starts in 5 days',
      body: `Your ${nextWin.label} collection window starts on ${nextWin.startDayKey}. Add at least 1 product to avoid falling behind.`,
      ctaHref: '/player/designoffices',
      kind: 'ACTION',
      level: 'INFO',
      category: 'MERCHANDISING',
    });
  }

  // START_TODAY: today is the first day of next collection
  if (daysUntilNextStart === 0) {
    drafts.push({
      dedupeKey: `GUIDE:COLL:START_TODAY:${hemisphere}:${nextWin.label}`,
      title: 'Collection starts today',
      body: `${nextWin.label} is now open. Start adding products to the collection.`,
      ctaHref: '/player/designoffices',
      kind: 'ACTION',
      level: 'INFO',
      category: 'MERCHANDISING',
    });
  }

  // REMINDER_7D: 7 days after next collection started, still 0 products
  if (daysSinceNextStart === 7) {
    drafts.push({
      dedupeKey: `GUIDE:COLL:REMINDER_7D:${hemisphere}:${nextWin.label}`,
      title: 'Collection reminder',
      body: `It's been a week since ${nextWin.label} opened and you still have 0 products in the collection.`,
      ctaHref: '/player/designoffices',
      kind: 'ACTION',
      level: 'WARNING',
      category: 'MERCHANDISING',
    });
  }

  return drafts;
}
