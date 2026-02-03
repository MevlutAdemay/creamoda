'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useChartColors } from './useChartColors';

type DataPoint = { category: string; amount: number };

type Props = { data: DataPoint[] };

const EMPTY = 'No data yet for the selected period.';

const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;

export function ExpenseBreakdownChart({ data }: Props) {
  const colors = useChartColors();
  const hasData = data.length > 0 && data.some((d) => d.amount > 0);

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
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} layout="vertical" barCategoryGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} opacity={0.5} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: colors.mutedForeground }} tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: colors.mutedForeground }} width={90} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card)', border: `1px solid ${colors.border}`, borderRadius: 'var(--radius)' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'OUT']}
          />
          <Bar dataKey="amount" fill={colors.c1} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
