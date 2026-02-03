'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useChartColors } from './useChartColors';
import { Badge } from '@/components/ui/badge';

export type BacklogHealthDataPoint = {
  dayKey: string;
  ordered: number;
  shipped: number;
};

export type BacklogKpis = {
  backlogUnitsNow: number;
  backlogDaysEquivalent: number;
  capacityNow: number;
};

type Props = {
  data: BacklogHealthDataPoint[];
  kpis: BacklogKpis;
};

const EMPTY_MESSAGE = 'No data yet for the selected period.';

function statusFromDays(days: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (days < 1) return { label: 'Healthy', variant: 'default' };
  if (days <= 3) return { label: 'Risky', variant: 'secondary' };
  return { label: 'Critical', variant: 'destructive' };
}

export function BacklogHealthChart({ data, kpis }: Props) {
  const { c1, c2, border, muted } = useChartColors();

  const hasData = data.length > 0 && data.some((d) => d.ordered > 0 || d.shipped > 0);
  const status = statusFromDays(kpis.backlogDaysEquivalent);
  const daysLabel =
    kpis.capacityNow > 0
      ? `${kpis.backlogDaysEquivalent.toFixed(1)} days`
      : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <span className="text-xs text-muted-foreground">Backlog now</span>
          <p className="text-xl font-semibold tabular-nums">{kpis.backlogUnitsNow}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Backlog (days equiv.)</span>
          <p className="text-xl font-semibold tabular-nums">{daysLabel}</p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {!hasData ? (
        <div className="flex h-[280px] items-center justify-center rounded-md border border-border/50 bg-muted/20 text-sm text-muted-foreground">
          {EMPTY_MESSAGE}
        </div>
      ) : (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} opacity={0.5} />
              <XAxis
                dataKey="dayKey"
                tick={{ fontSize: 11, fill: muted }}
                tickLine={{ stroke: border }}
                axisLine={{ stroke: border }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: muted }}
                tickLine={{ stroke: border }}
                axisLine={{ stroke: border }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: `1px solid ${border}`,
                  borderRadius: 'var(--radius)',
                }}
                labelStyle={{ color: 'var(--foreground)' }}
                formatter={(value: number) => [value, '']}
            labelFormatter={(label: string) => `Day: ${label}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => (value === 'ordered' ? 'Ordered' : 'Shipped')}
          />
              <Line
                type="monotone"
                dataKey="ordered"
                name="ordered"
                stroke={c1}
                strokeWidth={2}
                dot={{ r: 3, fill: c1 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="shipped"
                name="shipped"
                stroke={c2}
                strokeWidth={2}
                dot={{ r: 3, fill: c2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
