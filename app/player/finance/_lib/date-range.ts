/**
 * Finance date range: compute start/end dayKey from range param and current game day.
 */

import { normalizeUtcMidnight } from '@/lib/game/game-clock';

export type RangeKey = 'all' | '14d' | '30d' | 'thisMonth' | 'prevMonth';

export function getDateRangeForRangeKey(
  range: RangeKey,
  currentDayKey: Date
): { start: Date; end: Date } | null {
  const end = normalizeUtcMidnight(currentDayKey);
  const start = new Date(end);

  if (range === 'all') {
    return null; // Caller should omit dayKey filter
  }

  switch (range) {
    case '14d': {
      start.setUTCDate(start.getUTCDate() - 13);
      break;
    }
    case '30d': {
      start.setUTCDate(start.getUTCDate() - 29);
      break;
    }
    case 'thisMonth': {
      start.setUTCDate(1);
      break;
    }
    case 'prevMonth': {
      start.setUTCMonth(start.getUTCMonth() - 1);
      start.setUTCDate(1);
      const lastOfPrev = new Date(end);
      lastOfPrev.setUTCDate(0);
      return {
        start: normalizeUtcMidnight(start),
        end: normalizeUtcMidnight(lastOfPrev),
      };
    }
    default: {
      start.setUTCDate(start.getUTCDate() - 29);
    }
  }

  return {
    start: normalizeUtcMidnight(start),
    end: normalizeUtcMidnight(end),
  };
}
