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

type DataPoint = { dayKey: string; inUsd: number; outUsd: number; netUsd: number };

type Props = { data: DataPoint[] };

const EMPTY = 'No data yet for the selected period.';

export function CashflowLineChart({ data }: Props) {
  const { c1, c2, c3, border, mutedForeground } = useChartColors();
  const hasData = data.length > 0 && data.some((d) => d.inUsd > 0 || d.outUsd > 0);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md border border-border/50 bg-muted/20 text-sm text-muted-foreground">
        {EMPTY}
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={border} opacity={0.5} />
          <XAxis dataKey="dayKey" tick={{ fontSize: 11, fill: mutedForeground }} tickLine={{ stroke: border }} axisLine={{ stroke: border }} />
          <YAxis tick={{ fontSize: 11, fill: mutedForeground }} tickLine={{ stroke: border }} axisLine={{ stroke: border }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card)', border: `1px solid ${border}`, borderRadius: 'var(--radius)' }}
            formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === 'inUsd' ? 'IN' : name === 'outUsd' ? 'OUT' : 'Net']}
            labelFormatter={(label: string) => `Day: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: mutedForeground }} formatter={(v) => (v === 'inUsd' ? 'IN' : v === 'outUsd' ? 'OUT' : 'Net')} />
          <Line type="monotone" dataKey="inUsd" name="inUsd" stroke={c1} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="outUsd" name="outUsd" stroke={c2} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="netUsd" name="netUsd" stroke={c3} strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
