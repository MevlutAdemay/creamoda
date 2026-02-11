//app/lib/game/guidance-rules.ts

/**
 * Pure rule engine for guidance. No Prisma, no side effects.
 * INPUT: GuidanceFacts (dayKey, hemisphere, openCollections, counts, activeSalesSeason, staff).
 * OUTPUT: At most one GuidanceCard (highest priority).
 */

import type { CollectionWindow, Hemisphere, SalesSeasonWindow } from './season-calendar';
import { getOpenCollectionWindows } from './season-calendar';

export type OwnerRole = 'Designer' | 'Buyer' | 'Ops';
export type GuidanceSeverity = 'urgent' | 'warning' | 'info';

export type FlowStepDepartment = 'DESIGN' | 'BUYING';

export interface GuidanceCardStep {
  department: FlowStepDepartment;
  staffName: string | null;
  messageKey: string;
  params: Record<string, unknown>;
}

export interface GuidanceCard {
  id: string;
  ownerRole: OwnerRole;
  severity: GuidanceSeverity;
  messageKey: string;
  params: Record<string, unknown>;
  ctaHref: string;
  uiVariant?: 'FLOW' | 'SIMPLE';
  steps?: GuidanceCardStep[];
  ctaLabelKey?: string;
}

export interface GuidanceFacts {
  dayKey: string;
  hemisphere: Hemisphere;
  openCollections: CollectionWindow[];
  collectionCountsByCycleKey: Record<string, number>;
  activeSalesSeason: SalesSeasonWindow | null;
  staff: { designStaffName: string | null; buyingStaffName: string | null };
}

const MS_PER_DAY = 86400000;

export function addDaysToDayKey(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function diffDaysDayKey(a: string, b: string): number {
  const tA = new Date(`${a}T00:00:00.000Z`).getTime();
  const tB = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((tB - tA) / MS_PER_DAY);
}

function seasonFromWindow(w: CollectionWindow): string {
  return w.seasonType === 'FW' ? 'WINTER' : 'SUMMER';
}

function buildCtaHref(season: string): string {
  return `/player/collections?season=${encodeURIComponent(season)}`;
}

/**
 * Evaluate rules and return at most one card (highest priority).
 * Priority 0: Season kickoff flow (sales started today, 0 products for that cycle).
 * Priority 1: Collection just opened AND productCount === 0.
 * Priority 2: 5 days before collection start (START_IN_5D).
 * Priority 3: 7 days after start AND still 0 products (REMINDER_7D).
 */
export function evaluateGuidance(facts: GuidanceFacts): GuidanceCard[] {
  const { dayKey, hemisphere, openCollections, collectionCountsByCycleKey, activeSalesSeason, staff } = facts;
  const candidates: { card: GuidanceCard; priority: number; startDayKey: string }[] = [];

  // Priority 0: Season kickoff — sales started today, 0 products for active season cycle
  if (activeSalesSeason && dayKey === activeSalesSeason.startDayKey) {
    const count = collectionCountsByCycleKey[activeSalesSeason.cycleKey] ?? 0;
    if (count === 0) {
      const seasonLabel = activeSalesSeason.label;
      const season = activeSalesSeason.season;
      candidates.push({
        priority: 0,
        startDayKey: activeSalesSeason.startDayKey,
        card: {
          id: `guidance-flow-seasonKickoff-${activeSalesSeason.cycleKey}-${dayKey}`,
          ownerRole: 'Designer',
          severity: 'urgent',
          messageKey: 'guidance.flow.seasonKickoff.title',
          params: {
            label: seasonLabel,
            cycleKey: activeSalesSeason.cycleKey,
            season,
            hemisphere,
          },
          ctaHref: buildCtaHref(season),
          uiVariant: 'FLOW',
          ctaLabelKey: 'guidance.flow.seasonKickoff.cta',
          steps: [
            {
              department: 'DESIGN',
              staffName: staff.designStaffName,
              messageKey: 'guidance.flow.seasonKickoff.step1',
              params: { seasonLabel, season },
            },
            {
              department: 'DESIGN',
              staffName: staff.designStaffName,
              messageKey: 'guidance.flow.seasonKickoff.step2',
              params: { seasonLabel, season, timings: ['EARLY', 'CORE', 'LATE'] },
            },
            {
              department: 'BUYING',
              staffName: staff.buyingStaffName,
              messageKey: 'guidance.flow.seasonKickoff.step3',
              params: { seasonLabel, season },
            },
          ],
        },
      });
    }
  }

  // Priority 1: Collection just opened AND count === 0
  for (const win of openCollections) {
    if (win.startDayKey !== dayKey) continue;
    const count = collectionCountsByCycleKey[win.cycleKey] ?? 0;
    if (count > 0) continue;

    candidates.push({
      priority: 1,
      startDayKey: win.startDayKey,
      card: {
        id: `guidance-start-${win.cycleKey}-${dayKey}`,
        ownerRole: 'Designer',
        severity: 'urgent',
        uiVariant: 'SIMPLE',
        messageKey: 'guidance.collection.startToday',
        params: {
          label: win.label,
          cycleKey: win.cycleKey,
          hemisphere,
          seasonType: win.seasonType,
        },
        ctaHref: buildCtaHref(seasonFromWindow(win)),
        ctaLabelKey: 'guidance.collection.startToday.cta',
      },
    });
  }

  // Priority 2: 5 days before collection start (START_IN_5D)
  const dayKeyPlus5 = addDaysToDayKey(dayKey, 5);
  const windowsIn5Days = getOpenCollectionWindows(dayKeyPlus5, hemisphere).filter(
    (w) => w.startDayKey === dayKeyPlus5
  );
  for (const win of windowsIn5Days) {
    candidates.push({
      priority: 2,
      startDayKey: win.startDayKey,
      card: {
        id: `guide-ui-startin5d-${win.cycleKey}-${dayKey}`,
        ownerRole: 'Designer',
        severity: 'info',
        uiVariant: 'SIMPLE',
        messageKey: 'guidance.collection.startIn5d',
        params: {
          label: win.label,
          startDayKey: win.startDayKey,
          cycleKey: win.cycleKey,
          hemisphere,
        },
        ctaHref: buildCtaHref(seasonFromWindow(win)),
        ctaLabelKey: 'guidance.collection.startIn5d.cta',
      },
    });
  }

  // Priority 3: 7 days after start AND still 0 products (REMINDER_7D)
  const dayKeyMinus7 = addDaysToDayKey(dayKey, -7);
  for (const win of openCollections) {
    if (win.startDayKey !== dayKeyMinus7) continue;
    const count = collectionCountsByCycleKey[win.cycleKey] ?? 0;
    if (count > 0) continue;

    candidates.push({
      priority: 3,
      startDayKey: win.startDayKey,
      card: {
        id: `guide-ui-reminder7d-${win.cycleKey}-${dayKey}`,
        ownerRole: 'Designer',
        severity: 'urgent',
        uiVariant: 'SIMPLE',
        messageKey: 'guidance.collection.reminder7d',
        params: {
          label: win.label,
          cycleKey: win.cycleKey,
          hemisphere,
        },
        ctaHref: buildCtaHref(seasonFromWindow(win)),
        ctaLabelKey: 'guidance.collection.reminder7d.cta',
      },
    });
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.startDayKey.localeCompare(b.startDayKey);
  });
  return [candidates[0]!.card];
}
