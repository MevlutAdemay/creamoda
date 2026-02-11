// components/player/week-sim-header.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastCenter';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { usePlayerWallet } from '@/stores/usePlayerWallet';
import { useInboxUnread } from '@/stores/useInboxUnread';
import { Play } from 'lucide-react';
import { SimProgressOverlay } from './sim-progress-overlay';

/* ---------- types ---------- */

interface GameClockResponse {
  currentDayKey: string;
  currentDayKeyIso?: string;
}

interface AdvanceDayResponse {
  previousDayKey: string;
  newDayKey: string;
  warehousesTicked: number;
  settlementsRun: number;
  wallet?: { balanceUsd: number; balanceXp: number; balanceDiamond: number } | null;
  unread?: number;
}

/* ---------- date helpers (UTC only) ---------- */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Parse YYYY-MM-DD to UTC midnight Date */
function parseUtcDayKey(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/** Format Date as DD/MM/YYYY */
function formatDDMMYYYY(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Format Date as YYYY-MM-DD */
function formatIsoDay(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** ISO 8601 week number (Mon=1 based) */
function getIsoWeekNumber(d: Date): number {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = tmp.getUTCDay() || 7; // Sun=0 -> 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get Monday 00:00 UTC for the week containing `d` */
function getWeekMonday(d: Date): Date {
  const dayOfWeek = d.getUTCDay() || 7; // Sun=0 -> 7
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (dayOfWeek - 1));
  return monday;
}

/** Build 7 day objects Mon..Sun for the week containing `currentDayKey` */
function buildWeekDays(currentDayKey: string) {
  const active = parseUtcDayKey(currentDayKey);
  const monday = getWeekMonday(active);
  const activeDayIso = formatIsoDay(active);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86400000);
    const iso = formatIsoDay(d);
    return {
      label: DAY_LABELS[i]!,
      dateDisplay: formatDDMMYYYY(d),
      iso,
      isActive: iso === activeDayIso,
    };
  });
}

/* ---------- component ---------- */

/** Simulation step keys (1..12) for GSAP overlay or future use */
const STEP_KEYS = ['1','2','3','4','5','6','7','8','9','10','11','12'] as const;

export function WeekSimHeader() {
  const [currentDayKey, setCurrentDayKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations('simulation');
  const toast = useToast();
  const router = useRouter();
  const { setWallet } = usePlayerWallet();
  const { setUnread } = useInboxUnread();

  // Pre-resolved step texts for GSAP overlay component reuse
  const simulationSteps = STEP_KEYS.map((key) => t(`steps.${key}`));

  const fetchClock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/player/game-clock');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data: GameClockResponse = await res.json();
      setCurrentDayKey(data.currentDayKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load game clock';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClock();
  }, [fetchClock]);

  const handleAdvance = async () => {
    if (advancing) return;
    setAdvancing(true);
    setOverlayOpen(true);
    setError(null);
    try {
      const res = await fetch('/api/player/advance-day', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const result = data as AdvanceDayResponse;
      setCurrentDayKey(result.newDayKey);

      if (result.wallet) {
        setWallet({
          balanceUsd: result.wallet.balanceUsd,
          balanceXp: result.wallet.balanceXp,
          balanceDiamond: result.wallet.balanceDiamond,
        });
      }
      if (typeof result.unread === 'number') setUnread(result.unread);

      toast({
        kind: 'success',
        message: `Advanced to ${result.newDayKey}. Warehouses: ${result.warehousesTicked}, Settlements: ${result.settlementsRun}.`,
      });

      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to advance day';
      setError(msg);
      toast({ kind: 'error', message: msg });
    } finally {
      // Small delay so the last animation frame isn't cut off abruptly
      setTimeout(() => {
        setOverlayOpen(false);
        setAdvancing(false);
      }, 150);
    }
  };

  /* loading skeleton */
  if (loading && !currentDayKey) {
    return (
      <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto px-4 py-3 min-w-full">
          <div className="flex items-center justify-center gap-2 h-[72px]">
            <ModaVerseLogoLoader size={24} />
            <span className="text-sm text-muted-foreground">Loading week…</span>
          </div>
        </div>
      </div>
    );
  }

  const weekDays = currentDayKey ? buildWeekDays(currentDayKey) : [];
  const weekNumber = currentDayKey ? getIsoWeekNumber(parseUtcDayKey(currentDayKey)) : null;
  const activeDay = weekDays.find((d) => d.isActive) ?? weekDays[0];

  return (
    <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto px-4 py-3 min-w-full">
        <div className="flex items-center gap-4 min-w-0">
          {/* Week label */}
          <div className="shrink-0 flex flex-col items-center leading-none mr-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Week
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {weekNumber ?? '—'}
            </span>
          </div>

          {/* Mobile: single active day box */}
          {activeDay && (
            <div className="flex-1 min-w-0 sm:hidden">
              <div className="relative rounded-xl border border-primary/50 ring-1 ring-primary/30 px-2.5 py-1.5 text-center shadow-md bg-linear-to-b from-background to-muted/20">
                <p className="text-[10px] font-medium text-muted-foreground leading-tight">
                  {activeDay.label}
                </p>
                <p className="text-xs font-mono font-semibold tabular-nums leading-tight mt-0.5">
                  {activeDay.dateDisplay}
                </p>
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-primary/70" />
              </div>
            </div>
          )}

          {/* 7-day strip (sm and up) */}
          <div className="flex-1 min-w-0 hidden sm:grid grid-cols-7 gap-1.5">
            {weekDays.map((day) => (
              <div
                key={day.iso}
                className={[
                  'relative rounded-xl border px-1.5 py-1.5 text-center shadow-sm transition',
                  'bg-linear-to-b from-background to-muted/20',
                  day.isActive
                    ? 'border-primary/50 ring-1 ring-primary/30 shadow-md'
                    : 'hover:shadow',
                ].join(' ')}
              >
                <p className="text-[10px] font-medium text-muted-foreground leading-tight">
                  {day.label}
                </p>
                <p className="text-xs font-mono font-semibold tabular-nums leading-tight mt-0.5">
                  {day.dateDisplay}
                </p>
                {day.isActive && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-primary/70" />
                )}
              </div>
            ))}
          </div>

          {/* Sim button */}
          <div className="shrink-0">
            <Button
              onClick={handleAdvance}
              disabled={advancing || loading}
              size="sm"
              className="min-w-[80px]"
            >
              {advancing ? (
                <span className="inline-flex items-center gap-1.5">
                  <ModaVerseLogoLoader size={16} />
                  {t('runningTitle')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  {t('nextDay')}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Error line */}
        {error && (
          <p className="text-xs text-destructive mt-1.5">{error}</p>
        )}
      </div>

      {/* Simulation progress overlay */}
      {overlayOpen && (
        <SimProgressOverlay title={t('runningTitle')} steps={simulationSteps} />
      )}
    </div>
  );
}
