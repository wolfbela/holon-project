'use client';

import type { TicketStats } from '@shared/types/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPieChart } from './status-pie-chart';
import { PriorityBarChart } from './priority-bar-chart';

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <Skeleton className="aspect-square w-full max-h-[250px] rounded-lg" />
      </CardContent>
    </Card>
  );
}

interface ChartsRowProps {
  stats: TicketStats | null;
  isLoading: boolean;
}

export function ChartsRow({ stats, isLoading }: ChartsRowProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <StatusPieChart stats={stats} />
      <PriorityBarChart stats={stats} />
    </div>
  );
}
