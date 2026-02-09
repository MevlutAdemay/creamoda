/**
 * Home page guidance cards (UI only; no inbox writes).
 * Returns 0..2 cards based on calendar and product count.
 * TODO: Guidance tick (inbox messages) exists in lib/game/guidance-tick.ts; remove if unused.
 */

import type { CollectionWindow } from '@/lib/game/season-calendar';

export type GuidanceCard = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  severity?: 'urgent' | 'warning' | 'info';
};

export interface BuildHomeGuidanceParams {
  dayKeyStr: string;
  currentCollection: CollectionWindow | null;
  productCountCurrent: number;
}

/**
 * Build guidance cards for the Home page.
 * - Collection start / empty: show when current collection has started and productCount is 0.
 */
export function buildHomeGuidanceCards(params: BuildHomeGuidanceParams): GuidanceCard[] {
  const { dayKeyStr, currentCollection, productCountCurrent } = params;
  const cards: GuidanceCard[] = [];

  if (!currentCollection) return cards;
  if (productCountCurrent > 0) return cards;

  const hasStarted = dayKeyStr >= currentCollection.startDayKey;
  if (!hasStarted) return cards;

  cards.push({
    id: `coll-start-${currentCollection.label}`,
    title: `Start ${currentCollection.label} collection`,
    description: `${currentCollection.label} is active now. Add your first products to avoid falling behind.`,
    ctaLabel: 'Go to Design Offices',
    ctaHref: '/player/designoffices',
    severity: 'info',
  });

  return cards;
}
