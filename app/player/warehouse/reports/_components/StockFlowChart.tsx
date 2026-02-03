'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useChartColors } from './useChartColors';

export type StockFlowDataPoint = {
  dayKey: string;
  inbound: number;
  outbound: number;
};

type Props = {
  data: StockFlowDataPoint[];
};

const EMPTY_MESSAGE = 'No data yet for the selected period.';

export function StockFlowChart({ data }: Props) {
  const { c1, c2, border, muted } = useChartColors();

  const hasData = data.length > 0 && data.some((d) => d.inbound > 0 || d.outbound > 0);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md border border-border/50 bg-muted/20 text-sm text-muted-foreground">
        {EMPTY_MESSAGE}
      </div>
    );
  }

  const dataWithNet = data.map((d) => ({
    ...d,
    net: d.inbound - d.outbound,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dataWithNet} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={border} opacity={0.5} vertical={false} />
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
            labelFormatter={(label: string) => `Day: ${label}`}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length || !label) return null;
              const p = payload[0]?.payload as StockFlowDataPoint | undefined;
              const net = (p?.inbound ?? 0) - (p?.outbound ?? 0);
              return (
                <div className="rounded-md border border-border bg-card p-3 shadow-sm">
                  <p className="mb-2 text-sm font-medium text-foreground">Day: {label}</p>
                  <p className="text-xs text-muted-foreground">Inbound: {p?.inbound ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Outbound: {p?.outbound ?? 0}</p>
                  <p className="mt-1 text-xs font-medium text-foreground">Net: {net}</p>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => (value === 'inbound' ? 'Inbound' : 'Outbound')}
          />
          <Bar
            dataKey="inbound"
            name="inbound"
            stackId="flow"
            fill={c1}
            radius={[0, 0, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="outbound"
            name="outbound"
            stackId="flow"
            fill={c2}
            radius={[0, 0, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
