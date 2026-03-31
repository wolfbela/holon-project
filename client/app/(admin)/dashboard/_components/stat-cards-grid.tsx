'use client';

import { motion } from 'motion/react';
import { Ticket, CircleDot, CheckCircle2, Clock, type LucideIcon } from 'lucide-react';
import type { TicketStats } from '@shared/types/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconClassName?: string;
  delay?: number;
  highlighted?: boolean;
}

function StatCard({ title, value, icon: Icon, iconClassName, delay = 0, highlighted }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      <Card className={highlighted ? 'ring-2 ring-emerald-500/30 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06]' : undefined}>
        <CardContent className="flex items-center gap-4 p-6">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${iconClassName ?? 'bg-primary/10 text-primary'}`}>
            <Icon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`font-bold tracking-tight ${highlighted ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <Skeleton className="size-12 shrink-0 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardsGridProps {
  stats: TicketStats | null;
  isLoading: boolean;
}

export function StatCardsGrid({ stats, isLoading }: StatCardsGridProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Tickets"
        value={stats.total}
        icon={Ticket}
        iconClassName="bg-primary/10 text-primary"
        delay={0}
      />
      <StatCard
        title="Open Tickets"
        value={stats.open}
        icon={CircleDot}
        iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        delay={0.05}
        highlighted
      />
      <StatCard
        title="Closed Tickets"
        value={stats.closed}
        icon={CheckCircle2}
        iconClassName="bg-muted text-muted-foreground"
        delay={0.1}
      />
      <StatCard
        title="Avg Response Time"
        value={stats.avgResponseTime}
        icon={Clock}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        delay={0.15}
      />
    </div>
  );
}
