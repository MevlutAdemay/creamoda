//app/lib/game/guidance-tick.ts

/**
 * Server-side guidance tick: evaluate collection milestones and persist deduped inbox messages.
 * Called when game day advances or via API. Uses season-calendar + guidance-rules; no UI logic here.
 *
 * Milestones persisted (inbox):
 * A) Collection starts today (dayKey == window.startDayKey)
 *
 * START_IN_5D and REMINDER_7D are now UI-only guidance cards (see guidance-rules.ts).
 *
 * dedupeKey: GUIDE:COLLECTION:{TYPE}:{HEMISPHERE}:{CYCLEKEY}
 */

import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';
import {
  MessageCategory,
  MessageLevel,
  MessageKind,
  MessageCtaType,
  DepartmentCode,
} from '@prisma/client';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import {
  getOpenCollectionWindows,
  type CollectionWindow,
  type Hemisphere,
} from '@/lib/game/season-calendar';

type MilestoneType = 'START_TODAY';

function buildDedupeKey(type: MilestoneType, hemisphere: Hemisphere, cycleKey: string): string {
  return `GUIDE:COLLECTION:${type}:${hemisphere}:${cycleKey}`;
}

/**
 * Build collectionCountsByCycleKey from PlayerProduct snapshot fields only (groupBy).
 * Uses northCollectionKey / southCollectionKey; no date-window logic.
 */
async function getCollectionCountsByCycleKey(
  companyId: string,
  hemisphere: Hemisphere
): Promise<Record<string, number>> {
  const isNorth = hemisphere === 'NORTH';
  const keyField = isNorth ? 'northCollectionKey' : 'southCollectionKey';
  const rows = await prisma.playerProduct.groupBy({
    by: [keyField],
    where: {
      companyId,
      isActive: true,
      isUnlocked: true,
      [keyField]: { not: null },
    },
    _count: { id: true },
  });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = row[keyField];
    if (key != null) counts[key] = row._count.id;
  }
  return counts;
}

/**
 * Persist one milestone message if not already present (idempotent by dedupeKey).
 */
async function persistMilestone(
  playerId: string,
  dedupeKey: string,
  title: string,
  body: string,
  ctaHref: string
): Promise<'created' | 'skipped'> {
  const existing = await prisma.playerMessage.findUnique({
    where: {
      playerId_dedupeKey: { playerId, dedupeKey },
    },
  });
  if (existing) return 'skipped';
  try {
    await prisma.playerMessage.create({
      data: {
        playerId,
        category: MessageCategory.MERCHANDISING,
        department: DepartmentCode.MERCHANDISING,
        level: MessageLevel.INFO,
        kind: MessageKind.ACTION,
        title,
        body,
        ctaType: MessageCtaType.GO_TO_PAGE,
        ctaLabel: 'Design Offices',
        ctaPayload: { route: ctaHref },
        dedupeKey,
      },
    });
    return 'created';
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    if (code === 'P2002') return 'skipped';
    throw err;
  }
}

export interface GuidanceTickResult {
  dayKey: string;
  hemisphere: Hemisphere;
  created: number;
  skipped: number;
  messages: string[];
  reason?: string;
  debug?: {
    milestonesFired?: MilestoneType[];
    collectionCountsByCycleKey?: Record<string, number>;
  };
}

/**
 * Run collection guidance for a company. Call after advancing game day or from API with companyId.
 */
export async function runGuidanceTickForCompany(companyId: string): Promise<GuidanceTickResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, playerId: true },
  });
  if (!company?.playerId) {
    return {
      dayKey: '',
      hemisphere: 'NORTH',
      created: 0,
      skipped: 0,
      messages: [],
      reason: 'company_or_player_missing',
    };
  }

  const dayKeyDate = await getCompanyGameDayKey(companyId);
  const dayKey = dayKeyDate.toISOString().split('T')[0]!;
  const playerId = company.playerId;

  const firstWarehouse = await prisma.companyBuilding.findFirst({
    where: { companyId, role: BuildingRole.WAREHOUSE },
    select: { country: { select: { hemisphere: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const hemisphere: Hemisphere =
    firstWarehouse?.country?.hemisphere === 'SOUTH' ? 'SOUTH' : 'NORTH';

  const [collectionCountsByCycleKey, openWindows] = await Promise.all([
    getCollectionCountsByCycleKey(companyId, hemisphere),
    Promise.resolve(getOpenCollectionWindows(dayKey, hemisphere)),
  ]);

  const milestonesFired: MilestoneType[] = [];
  const created: string[] = [];
  let skipped = 0;

  const ctaHref = (w: CollectionWindow) =>
    `/player/collections?season=${encodeURIComponent(w.seasonType === 'FW' ? 'WINTER' : 'SUMMER')}`;

  // A) Collection starts today — persist inbox message
  for (const w of openWindows) {
    if (w.startDayKey !== dayKey) continue;
    const dedupeKey = buildDedupeKey('START_TODAY', hemisphere, w.cycleKey);
    const result = await persistMilestone(
      playerId,
      dedupeKey,
      'Collection starts today',
      `${w.label} is now open. Start adding products to the collection.`,
      ctaHref(w)
    );
    if (result === 'created') {
      created.push(dedupeKey);
      milestonesFired.push('START_TODAY');
    } else skipped += 1;
  }

  // START_IN_5D and REMINDER_7D are now UI-only guidance cards (guidance-rules.ts).
  // No inbox persistence for these milestones.

  return {
    dayKey,
    hemisphere,
    created: created.length,
    skipped,
    messages: created,
    debug: {
      milestonesFired: milestonesFired.length ? milestonesFired : undefined,
      collectionCountsByCycleKey,
    },
  };
}
