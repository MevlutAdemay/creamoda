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

export type ThroughputCapacityDataPoint = {
  dayKey: string;
  shipped: number;
  capacity: number;
};

type Props = {
  data: ThroughputCapacityDataPoint[];
};

const EMPTY_MESSAGE = 'No data yet for the selected period.';

export function ThroughputCapacityChart({ data }: Props) {
  const { c1, c2, border, muted } = useChartColors();

  const hasData = data.length > 0 && data.some((d) => d.shipped > 0 || d.capacity > 0);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md border border-border/50 bg-muted/20 text-sm text-muted-foreground">
        {EMPTY_MESSAGE}
      </div>
    );
  }

  return (
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
            formatter={(value: string) => (value === 'shipped' ? 'Shipped' : 'Capacity')}
          />
          <Line
            type="monotone"
            dataKey="shipped"
            name="shipped"
            stroke={c1}
            strokeWidth={2}
            dot={{ r: 3, fill: c1 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="capacity"
            name="capacity"
            stroke={c2}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 2, fill: c2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
