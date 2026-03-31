'use client';

import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { StatCardsGrid } from './stat-cards-grid';
import { ChartsRow } from './charts-row';
import { RecentTicketsList } from './recent-tickets-list';

export function DashboardContent() {
  const { stats, recentTickets, isLoading, hasError, retry } = useDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of your support operations.
        </p>
      </div>

      <StatCardsGrid stats={stats} isLoading={isLoading} />
      <ChartsRow stats={stats} isLoading={isLoading} />
      <RecentTicketsList tickets={recentTickets} isLoading={isLoading} />

      {hasError && !isLoading && (
        <div className="flex items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 py-6">
          <p className="text-sm text-destructive">
            Something went wrong.{' '}
            <button onClick={retry} className="font-medium underline underline-offset-4 hover:no-underline">
              Try again
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
