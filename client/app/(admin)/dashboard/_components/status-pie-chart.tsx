'use client';

import { Label, Pie, PieChart } from 'recharts';
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
  open: { label: 'Open', color: 'oklch(0.765 0.177 163.223)' },
  closed: { label: 'Closed', color: 'oklch(0.556 0 0)' },
} satisfies ChartConfig;

interface StatusPieChartProps {
  stats: TicketStats;
}

export function StatusPieChart({ stats }: StatusPieChartProps) {
  const data = [
    { status: 'open', count: stats.open, fill: 'var(--color-open)' },
    { status: 'closed', count: stats.closed, fill: 'var(--color-closed)' },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Tickets by Status</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.total === 0 ? (
          <div className="flex aspect-square max-h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No data yet</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {stats.total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 24}
                            className="fill-muted-foreground text-sm"
                          >
                            Total
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
