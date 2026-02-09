/**
 * Server-side guidance tick: run collection guidance rules and write deduped messages.
 * Call from advance-day (after day advances) or from API /api/player/guidance/tick.
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
import { getCompanyGameDayKey, formatDayKeyString, parseDayKeyString } from '@/lib/game/game-clock';
import { getCollectionWindow } from '@/lib/game/season-calendar';
import { buildCollectionGuidance } from '@/lib/game/guidance-rules';
import type { Hemisphere } from '@/lib/game/season-calendar';

const MS_PER_DAY = 86400000;

export interface GuidanceTickResult {
  dayKey: string;
  hemisphere: Hemisphere;
  created: number;
  skipped: number;
  messages: string[];
  reason?: string;
  debug?: { nextWinLabel?: string; productCountNext?: number; draftsCount?: number };
}

/**
 * Run collection guidance for a company (no session required).
 * Use after advancing game day or from API with session-resolved companyId.
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

  const dayKey = await getCompanyGameDayKey(companyId);
  const dayKeyStr = formatDayKeyString(dayKey);

  const firstWarehouse = await prisma.companyBuilding.findFirst({
    where: { companyId, role: BuildingRole.WAREHOUSE },
    select: { country: { select: { hemisphere: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const hemisphere: Hemisphere =
    firstWarehouse?.country?.hemisphere === 'SOUTH' ? 'SOUTH' : 'NORTH';

  const collectionResult = getCollectionWindow(dayKeyStr, hemisphere, { strict: false });
  if (!collectionResult?.next) {
    return {
      dayKey: dayKeyStr,
      hemisphere,
      created: 0,
      skipped: 0,
      messages: [],
      reason: 'no_next_collection_window',
      debug: {},
    };
  }

  const nextWin = collectionResult.next;
  const startDate = parseDayKeyString(nextWin.startDayKey);
  const endPlus1 = new Date(
    parseDayKeyString(nextWin.endDayKey).getTime() + MS_PER_DAY
  );

  const productCountNext = await prisma.playerProduct.count({
    where: {
      companyId,
      isActive: true,
      isUnlocked: true,
      OR: [
        { launchedAtDayKey: { gte: startDate, lt: endPlus1 } },
        {
          launchedAtDayKey: null,
          createdAt: { gte: startDate, lt: endPlus1 },
        },
      ],
    },
  });

  const drafts = buildCollectionGuidance({
    dayKey: dayKeyStr,
    hemisphere,
    nextWin,
    productCountNext,
  });

  const created: string[] = [];
  let skipped = 0;

  for (const d of drafts) {
    const existing = await prisma.playerMessage.findUnique({
      where: {
        playerId_dedupeKey: { playerId: company.playerId, dedupeKey: d.dedupeKey },
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      await prisma.playerMessage.create({
        data: {
          playerId: company.playerId,
          category: (d.category as MessageCategory) ?? MessageCategory.MERCHANDISING,
          department: DepartmentCode.MERCHANDISING,
          level: (d.level as MessageLevel) ?? MessageLevel.INFO,
          kind: (d.kind as MessageKind) ?? MessageKind.ACTION,
          title: d.title,
          body: d.body,
          ctaType: MessageCtaType.GO_TO_PAGE,
          ctaLabel: 'Design Offices',
          ctaPayload: { route: d.ctaHref },
          dedupeKey: d.dedupeKey,
        },
      });
      created.push(d.dedupeKey);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (code === 'P2002') {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  return {
    dayKey: dayKeyStr,
    hemisphere,
    created: created.length,
    skipped,
    messages: created,
    debug: {
      nextWinLabel: nextWin.label,
      productCountNext,
      draftsCount: drafts.length,
    },
  };
}
