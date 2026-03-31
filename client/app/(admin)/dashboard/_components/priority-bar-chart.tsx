'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { TicketStats } from '@shared/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  count: { label: 'Tickets' },
  low: { label: 'Low', color: 'oklch(0.623 0.214 259.815)' },
  medium: { label: 'Medium', color: 'oklch(0.769 0.188 70.08)' },
  high: { label: 'High', color: 'oklch(0.637 0.237 25.331)' },
} satisfies ChartConfig;

interface PriorityBarChartProps {
  stats: TicketStats;
}

export function PriorityBarChart({ stats }: PriorityBarChartProps) {
  const data = [
    { priority: 'low', count: stats.byPriority.low, fill: 'var(--color-low)' },
    { priority: 'medium', count: stats.byPriority.medium, fill: 'var(--color-medium)' },
    { priority: 'high', count: stats.byPriority.high, fill: 'var(--color-high)' },
  ];

  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Tickets by Priority</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex aspect-square max-h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No data yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
            <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="priority"
                type="category"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: string) =>
                  chartConfig[value as keyof typeof chartConfig]?.label ?? value
                }
              />
              <XAxis type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
