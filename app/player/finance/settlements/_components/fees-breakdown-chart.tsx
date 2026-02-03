'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useChartColors } from '../../_components/useChartColors';

type DataPoint = {
  bucket: string;
  commissionFeeUsd: number;
  logisticsFeeUsd: number;
  returnDeductionUsd: number;
};

type Props = { data: DataPoint[] };

const EMPTY = 'No data yet for the selected period.';

export function FeesBreakdownChart({ data }: Props) {
  const { c1, c2, c3, border, mutedForeground } = useChartColors();
  const hasData = data.length > 0 && data.some((d) => d.commissionFeeUsd !== 0 || d.logisticsFeeUsd !== 0 || d.returnDeductionUsd !== 0);

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
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={border} opacity={0.5} vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: mutedForeground }} tickLine={{ stroke: border }} axisLine={{ stroke: border }} />
          <YAxis tick={{ fontSize: 11, fill: mutedForeground }} tickLine={{ stroke: border }} axisLine={{ stroke: border }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card)', border: `1px solid ${border}`, borderRadius: 'var(--radius)' }}
            formatter={(value: number) => [`$${Number(value).toLocaleString()}`, '']}
            labelFormatter={(label: string) => `Period: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: mutedForeground }} />
          <Bar dataKey="commissionFeeUsd" name="Commission" stackId="fees" fill={c1} radius={[0, 0, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="logisticsFeeUsd" name="Logistics" stackId="fees" fill={c2} radius={[0, 0, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="returnDeductionUsd" name="Returns" stackId="fees" fill={c3} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
