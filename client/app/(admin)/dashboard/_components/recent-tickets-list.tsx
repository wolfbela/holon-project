'use client';

import Link from 'next/link';
import { ArrowRight, ChevronRight, InboxIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { Ticket } from '@shared/types/ticket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, PriorityBadge } from '@/components/ticket-badges';
import { formatRelativeTime } from '@/lib/format';

function RecentTicketsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg p-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

interface RecentTicketsListProps {
  tickets: Ticket[];
  isLoading: boolean;
}

export function RecentTicketsList({ tickets, isLoading }: RecentTicketsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Recent Tickets</CardTitle>
        <Link
          href="/tickets"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
          <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <RecentTicketsSkeleton />
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <InboxIcon className="size-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No tickets yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tickets.map((ticket, i) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04, ease: 'easeOut' }}
              >
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                >
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {ticket.display_id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {ticket.subject}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(ticket.created_at)}
                  </time>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
