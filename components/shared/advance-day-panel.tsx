'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/ToastCenter';

interface AdvanceDayPanelProps {
  open: boolean;
}

interface GameClockResponse {
  currentDayKey: string;
  currentDayKeyIso?: string;
}

interface AdvanceDayResponse {
  previousDayKey: string;
  newDayKey: string;
  warehousesTicked: number;
  settlementsRun: number;
}

export default function AdvanceDayPanel({ open }: AdvanceDayPanelProps) {
  const [currentDayKey, setCurrentDayKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AdvanceDayResponse | null>(null);
  const toast = useToast();

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
      setCurrentDayKey(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchClock();
  }, [open, fetchClock]);

  const handleAdvance = async () => {
    setAdvancing(true);
    setError(null);
    try {
      const res = await fetch('/api/player/advance-day', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const result = data as AdvanceDayResponse;
      setLastResult(result);
      setCurrentDayKey(result.newDayKey);
      toast({
        kind: 'success',
        message: `Advanced to ${result.newDayKey}. Warehouses: ${result.warehousesTicked}, Settlements: ${result.settlementsRun}.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to advance day';
      setError(msg);
      toast({ kind: 'error', message: msg });
    } finally {
      setAdvancing(false);
    }
  };

  const handleRefresh = () => {
    fetchClock();
    setLastResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Current Day */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Current Day
        </p>
        {loading && !currentDayKey ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error && !currentDayKey ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : currentDayKey ? (
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-mono font-semibold">{currentDayKey}</p>
            <p className="text-xs text-muted-foreground font-mono">
              UTC midnight
            </p>
          </div>
        ) : null}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleAdvance}
          disabled={advancing || loading}
          className="min-w-[120px]"
        >
          {advancing ? 'Advancing…' : 'Advance 1 Day'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error && currentDayKey && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Last action result */}
      {lastResult && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
          <p className="font-medium text-muted-foreground">Last advance</p>
          <p>
            Advanced from <span className="font-mono">{lastResult.previousDayKey}</span> to{' '}
            <span className="font-mono">{lastResult.newDayKey}</span>
          </p>
          <p>Warehouses ticked: {lastResult.warehousesTicked}</p>
          <p>Settlements run: {lastResult.settlementsRun}</p>
        </div>
      )}
    </div>
  );
}
