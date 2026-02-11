// components/shared/advance-day-panel.tsx


'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/ToastCenter';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { usePlayerWallet } from '@/stores/usePlayerWallet';
import { useInboxUnread } from '@/stores/useInboxUnread';

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
  wallet?: { balanceUsd: number; balanceXp: number; balanceDiamond: number } | null;
  unread?: number;
}

interface SimDebugRow {
  dayKey: string;
  warehouseBuildingId?: string;
  warehouseName?: string;
  marketZone: string;
  productTemplateId: string;
  productName?: string;
  qtyOrdered: number;
  qtyShipped: number;
  expectedUnits?: number;
  priceIndex?: number;
  seasonScore?: number;
  priceMultiplier?: number;
  tierUsed?: number;
  bandMatched?: boolean;
  finalDesired?: number | null;
  blockedByPrice?: boolean;
  blockedBySeason?: boolean;
}

export default function AdvanceDayPanel({ open }: AdvanceDayPanelProps) {
  const [currentDayKey, setCurrentDayKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AdvanceDayResponse | null>(null);
  const [debugRows, setDebugRows] = useState<SimDebugRow[]>([]);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const toast = useToast();
  const { setWallet } = usePlayerWallet();
  const { setUnread } = useInboxUnread();

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

  const fetchSimDebug = useCallback(async () => {
    setDebugLoading(true);
    setDebugError(null);
    try {
      const res = await fetch('/api/player/sim-debug?days=7');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data: SimDebugRow[] = await res.json();
      setDebugRows(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load sales debug';
      setDebugError(msg);
      setDebugRows([]);
    } finally {
      setDebugLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchClock();
      fetchSimDebug();
    }
  }, [open, fetchClock, fetchSimDebug]);

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
      fetchSimDebug();
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

  const handleRefreshDebug = () => {
    fetchSimDebug();
  };

  return (
    <div className="space-y-4">
      {/* Current Day */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Current Day
        </p>
        {loading && !currentDayKey ? (
          <div className="flex items-center gap-2">
            <ModaVerseLogoLoader size={24} className="text-primary" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
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
          {advancing ? (
            <span className="inline-flex items-center gap-2">
              <ModaVerseLogoLoader size={18} className="text-primary-foreground" />
              Advancing…
            </span>
          ) : (
            'Advance 1 Day'
          )}
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

      <Separator />

      {/* Sales Debug (Last 7 days) */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sales Debug (Last 7 days)
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefreshDebug}
            disabled={debugLoading}
          >
            {debugLoading ? 'Loading…' : 'Refresh Debug'}
          </Button>
        </div>
        {debugError && (
          <p className="text-sm text-destructive mb-2">{debugError}</p>
        )}
        {debugLoading && debugRows.length === 0 ? (
          <div className="flex items-center gap-2">
            <ModaVerseLogoLoader size={24} className="text-primary" />
            <span className="text-sm text-muted-foreground">Loading sales debug…</span>
          </div>
        ) : debugRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales log rows in the last 7 days.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto max-h-[320px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Ord</TableHead>
                  <TableHead className="text-right">Ship</TableHead>
                  <TableHead className="text-right">Exp</TableHead>
                  <TableHead className="text-right">PIdx</TableHead>
                  <TableHead className="text-right">Seas</TableHead>
                  <TableHead className="text-right">PMul</TableHead>
                  <TableHead className="text-right">Tier</TableHead>
                  <TableHead>Band</TableHead>
                  <TableHead className="text-right">Fin</TableHead>
                  <TableHead>Block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debugRows.map((r, i) => (
                  <TableRow key={`${r.dayKey}-${r.productTemplateId}-${r.warehouseBuildingId ?? ''}-${i}`}>
                    <TableCell className="font-mono text-xs">{r.dayKey}</TableCell>
                    <TableCell className="text-xs truncate max-w-[80px]" title={r.warehouseName ?? r.warehouseBuildingId}>
                      {r.warehouseName ?? (r.warehouseBuildingId?.slice(0, 8) ?? '—')}
                    </TableCell>
                    <TableCell className="text-xs">{r.marketZone}</TableCell>
                    <TableCell className="text-xs truncate max-w-[100px]" title={r.productName ?? r.productTemplateId}>
                      {r.productName ?? r.productTemplateId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.qtyOrdered}</TableCell>
                    <TableCell className="text-right text-xs">{r.qtyShipped}</TableCell>
                    <TableCell className="text-right text-xs">{r.expectedUnits ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs">{r.priceIndex ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs">{r.seasonScore ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs">{r.priceMultiplier ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs">{r.tierUsed ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.bandMatched === true ? 'Y' : r.bandMatched === false ? 'N' : '—'}</TableCell>
                    <TableCell className="text-right text-xs">{r.finalDesired ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {[r.blockedByPrice && 'P', r.blockedBySeason && 'S'].filter(Boolean).join(',') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
