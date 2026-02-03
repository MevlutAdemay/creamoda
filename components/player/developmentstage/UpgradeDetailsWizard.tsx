'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/ToastCenter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Package, Users, DollarSign } from 'lucide-react';

export type UpgradePreviewData = {
  building: { id: string; name: string | null; marketZone: string | null; countryId: string };
  metricType: string;
  current: { level: number; count: number };
  target: { level: number; minRequired: number | null; maxAllowed: number | null };
  eligible: boolean;
  ineligibleReason: string | null;
  costs: {
    upgradeCostMoney: number;
    equipmentCostMoney: number;
    totalCostMoney: number;
    payrollMonthlyDelta: number;
  };
  staff: Array<{
    departmentCode: string;
    roleCode: string;
    roleName: string;
    neededHeadcount: number;
    monthlySalaryEach: number;
    monthlyTotal: number;
  }>;
  equipment: Array<{
    code: string;
    name: string;
    neededQty: number;
    unitCost: number;
    totalCost: number;
  }>;
  awardXpOnUpgrade: number;
};

type UpgradeDetailsWizardProps = {
  buildingId: string;
  metricType: 'STOCK_COUNT' | 'SALES_COUNT' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const METRIC_LABELS: Record<string, string> = {
  STOCK_COUNT: 'Stock Capacity',
  SALES_COUNT: 'Daily Sales Capacity',
};

const STEPS = [
  { id: 1 as const, label: 'Equipment', icon: Package },
  { id: 2 as const, label: 'Staff', icon: Users },
  { id: 3 as const, label: 'Costs', icon: DollarSign },
];

export function UpgradeDetailsWizard({
  buildingId,
  metricType,
  open,
  onOpenChange,
}: UpgradeDetailsWizardProps) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<UpgradePreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !buildingId || !metricType) {
      setData(null);
      setError(null);
      setStep(1);
      return;
    }
    setStep(1);
    setLoading(true);
    setError(null);
    fetch(
      `/api/player/warehouse/upgrade/preview?buildingId=${encodeURIComponent(buildingId)}&metricType=${encodeURIComponent(metricType)}`
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Failed to load preview');
          setData(null);
          return;
        }
        setData(json);
        setError(null);
      })
      .catch(() => {
        setError('Failed to load preview');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [open, buildingId, metricType]);

  const metricLabel = metricType ? METRIC_LABELS[metricType] ?? metricType : '';
  const buildingName = data?.building.name?.trim() || 'Warehouse';

  const equipmentNeeded = data?.equipment.filter((e) => e.neededQty > 0) ?? [];
  const staffNeeded = data?.staff.filter((s) => s.neededHeadcount > 0) ?? [];

  const handleUpgradeClick = async () => {
    if (!data?.eligible || !buildingId || !metricType) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/player/warehouse/upgrade/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId,
          metricType,
          expectedTargetLevel: data.target.level,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          kind: 'error',
          message: json.error ?? json.detail ?? 'Upgrade failed',
        });
        return;
      }
      onOpenChange(false);
      toast({
        kind: 'success',
        message: `Upgrade complete. Level ${json.previousLevel} → ${json.newLevel}.`,
      });
    } catch (e) {
      toast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Upgrade failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex min-h-[80vh]  max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Upgrade Preview
            <span className="text-xs text-muted-foreground">· {buildingName}</span>
            {metricType && (
              <Badge variant="secondary" className="text-xs font-bold text-muted-foreground">
                {metricLabel}
              </Badge>
            )}
          </DialogTitle>
          {!loading && !error && data && (
            <Alert
              className={cn(
                'mt-2',
                data.eligible
                  ? 'border-muted bg-muted/30 text-foreground'
                  : 'border-amber-500/50'
              )}
            >
              <AlertDescription>
                {data.eligible
                  ? 'You meet the requirements for this upgrade.'
                  : data.ineligibleReason}
              </AlertDescription>
            </Alert>
          )}
        </DialogHeader>

        {/* Stepper */}
        {!loading && !error && data && (
          <div className="shrink-0 border-b bg-muted/30 px-6 py-3">
            <nav className="flex w-full items-center" aria-label="Progress">
              {STEPS.map((s, idx) => {
                const isActive = step === s.id;
                const isPast = step > s.id;
                const Icon = s.icon;
                const linePast = step > s.id;
                return (
                  <Fragment key={s.id}>
                    <button
                      type="button"
                      onClick={() => setStep(s.id)}
                      className={cn(
                        'shrink-0 flex flex-col items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                        isActive && 'bg-background text-foreground shadow-sm',
                        isPast && 'text-muted-foreground hover:text-foreground',
                        !isActive && !isPast && 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px]',
                          isActive && 'border-foreground bg-background',      
                          isPast && 'border-muted-foreground bg-muted',
                          !isActive && !isPast && 'border-muted-foreground bg-muted/50'
                        )}
                      >
                        {isPast ? (
                          <span className="text-xs">✓</span>
                        ) : (
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </span>
                      {s.label}
                    </button>
                    {idx < STEPS.length - 1 && (
                      <div className="flex min-w-4 flex-1 items-center px-2">
                        <div
                          className={cn(
                            'h-px w-full',
                            linePast ? 'bg-muted-foreground/50' : 'bg-muted'
                          )}
                          aria-hidden
                        />
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </nav>
          </div>
        )}

        {/* Body */}
        <ScrollArea className="min-h-[200px] flex-1 justify-center">
          <div className="px-6 py-4">
            {loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!loading && !error && data && (
              <>
                {step === 1 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-foreground">Equipment Requirements</h4>
                    {equipmentNeeded.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No additional equipment required for this upgrade.
                      </p>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-xs">
                              <TableHead className="text-xs">Equipment</TableHead>
                              <TableHead className="text-xs text-right w-16">Needed</TableHead>
                              <TableHead className="text-xs text-right">Unit Cost</TableHead>
                              <TableHead className="text-xs text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {equipmentNeeded.map((row) => (
                              <TableRow key={row.code} className="text-sm">
                                <TableCell>
                                  <div className="font-medium">{row.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{row.code}</div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{row.neededQty}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatCurrency(row.unitCost)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatCurrency(row.totalCost)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-foreground">Staff Requirements</h4>
                    {staffNeeded.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No additional staff required for this upgrade.
                      </p>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-xs">
                              <TableHead className="text-xs">Role</TableHead>
                              <TableHead className="text-xs">Department</TableHead>
                              <TableHead className="text-xs text-right">Monthly Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {staffNeeded.map((row) => (
                              <TableRow key={`${row.departmentCode}-${row.roleCode}`} className="text-sm">
                                <TableCell className="font-medium">{row.roleName}</TableCell>
                                <TableCell className="text-muted-foreground">{row.departmentCode}</TableCell>
                                
                                <TableCell className="text-right tabular-nums">
                                  {formatCurrency(row.monthlyTotal)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-foreground">Costs & Summary</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Card className="border bg-card">
                        <CardContent className="p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Upgrade cost
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {formatCurrency(data.costs.upgradeCostMoney)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border bg-card">
                        <CardContent className="p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Equipment cost
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {formatCurrency(data.costs.equipmentCostMoney)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border bg-card col-span-2">
                        <CardContent className="p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Monthly payroll delta
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {formatCurrency(data.costs.payrollMonthlyDelta)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border bg-card col-span-2">
                        <CardContent className="p-3">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Total immediate cost
                          </div>
                          <div className="text-base font-semibold tabular-nums">
                            {formatCurrency(data.costs.totalCostMoney)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="rounded-md border bg-muted/20 p-3">
                      <div className="text-xs font-medium text-foreground">What changes after upgrade?</div>
                      <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                        <span>Target level: {data.target.level}</span>
                        {data.target.maxAllowed != null && (
                          <span>New max allowed: {data.target.maxAllowed}</span>
                        )}
                      </div>
                    </div>

                    {!data.eligible && data.target.minRequired != null && (
                      <p className="text-xs text-muted-foreground">
                        Requires at least {data.target.minRequired} to upgrade. Current: {data.current.count}.
                      </p>
                    )}

                    {data.awardXpOnUpgrade > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Award: {data.awardXpOnUpgrade} XP on upgrade
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 flex-row gap-2 border-t px-6 py-4 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex flex-1 justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              disabled={step === 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                disabled={!data?.eligible || submitting}
                onClick={handleUpgradeClick}
              >
                {submitting ? 'Upgrading…' : 'Upgrade'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
