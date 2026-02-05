// creamoda/app/player/warehouse/logistics/_components/PartTimePreviewCard.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastCenter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { Users } from 'lucide-react';
import { usePlayerWallet } from '@/stores/usePlayerWallet';

const CAPACITY_PER_WORKER = 20;
const BASE_COST_PER_WORKER = 60;

type PartTimePreviewCardProps = {
  buildingId: string;
  backlogUnitsTotal: number;
  salaryMultiplier: number;
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PartTimePreviewCard({
  buildingId,
  backlogUnitsTotal,
  salaryMultiplier,
}: PartTimePreviewCardProps) {
  const toast = useToast();
  const router = useRouter();
  const { setWallet } = usePlayerWallet();

  const maxStaffForBacklog = Math.ceil(backlogUnitsTotal / CAPACITY_PER_WORKER);
  const [staffCount, setStaffCount] = useState(maxStaffForBacklog);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (staffCount > maxStaffForBacklog) {
      setStaffCount(maxStaffForBacklog);
    }
  }, [maxStaffForBacklog, staffCount]);

  const extraCapacity = staffCount * CAPACITY_PER_WORKER;
  const willClear = Math.min(backlogUnitsTotal, extraCapacity);
  const costUsd = staffCount * BASE_COST_PER_WORKER * salaryMultiplier;

  const handleApply = async () => {
    if (staffCount <= 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/player/warehouse/logistics/part-time/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, staffCount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          kind: 'error',
          message: data.error ?? `Request failed (${res.status})`,
        });
        return;
      }
      const cleared = data.clearedUnits ?? 0;
      if (data.wallet) {
        setWallet({
          balanceUsd: data.wallet.balanceUsd,
          balanceXp: data.wallet.balanceXp,
          balanceDiamond: data.wallet.balanceDiamond,
        });
      }
      toast({
        kind: 'success',
        message: `Cleared ${cleared} units with part-time staff.`,
      });
      router.refresh();
    } catch (e) {
      toast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Apply failed',
      });
    } finally {
      setLoading(false);
    }
  };

  if (backlogUnitsTotal <= 0 || dismissed) return null;

  return (
    <Card className="border border-muted bg-muted/20 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="h-4 w-4" />
          Part-time staff (preview)
        </CardTitle>
        <CardDescription>
          Clear backlog faster. Capacity-limited; stock is already reserved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">{backlogUnitsTotal}</span> units of backlog can be cleared with up to{' '}
          <span className="font-medium tabular-nums text-foreground">{maxStaffForBacklog}</span> part-time staff.
          {maxStaffForBacklog > 1 && (
            <> You can select fewer (1–{maxStaffForBacklog - 1}) if you want.</>
          )}
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Staff count (0–{maxStaffForBacklog})
          </label>
          <input
            type="number"
            min={0}
            max={maxStaffForBacklog}
            value={staffCount}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setStaffCount(Number.isNaN(v) ? 0 : Math.max(0, Math.min(maxStaffForBacklog, v)));
            }}
            disabled={loading}
            className="w-full max-w-[120px] rounded-md border bg-background px-3 py-2 text-sm tabular-nums"
          />
        </div>
        <div className="rounded-md border bg-background/50 p-3 text-sm">
          <p className="font-medium tabular-nums">
            Today will clear {willClear} units
          </p>
          <p className="text-muted-foreground">
            Cost: {formatUsd(costUsd)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleApply}
            disabled={loading || staffCount <= 0}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <ModaVerseLogoLoader size={18} className="text-primary-foreground" />
                Applying…
              </span>
            ) : (
              'Apply Part-time'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setDismissed(true)}
            disabled={loading}
          >
            Not now
          </Button>       
        </div>
      </CardContent>
    </Card>
  );
}
