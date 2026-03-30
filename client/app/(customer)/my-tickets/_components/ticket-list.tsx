'use client';

import Link from 'next/link';
import { Ticket as TicketIcon } from 'lucide-react';
import type { Ticket } from '@shared/types/ticket';
import type { TicketStatus } from '@shared/types/ticket';
import type { PaginationMeta } from '@shared/types/api';
import { EmptyState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import { TicketCard } from './ticket-card';
import { TicketCardSkeleton } from './ticket-card-skeleton';

interface TicketListProps {
  tickets: Ticket[];
  isLoading: boolean;
  pagination: PaginationMeta | null;
  statusFilter?: TicketStatus;
  onPageChange: (page: number) => void;
  onClearFilter?: () => void;
}

export function TicketList({
  tickets,
  isLoading,
  pagination,
  statusFilter,
  onPageChange,
  onClearFilter,
}: TicketListProps) {
  if (isLoading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <TicketCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    if (statusFilter) {
      return (
        <EmptyState
          icon={TicketIcon}
          title={`No ${statusFilter} tickets`}
          description={`You don\u2019t have any ${statusFilter} tickets at the moment.`}
          action={
            onClearFilter && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={onClearFilter}
              >
                Show all tickets
              </Button>
            )
          }
        />
      );
    }

    return (
      <EmptyState
        icon={TicketIcon}
        title="No tickets yet"
        description="Browse products to create a support ticket."
        action={
          <Link href="/products">
            <Button variant="outline" size="sm" className="rounded-full">
              Browse Products
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      {pagination && pagination.total > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {pagination.total} {pagination.total === 1 ? 'ticket' : 'tickets'}
          {statusFilter ? ` ${statusFilter}` : ''}
        </p>
      )}
      <div className="flex flex-col gap-4">
        {tickets.map((ticket, index) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            delay={Math.min(index * 0.05, 0.5)}
          />
        ))}
      </div>
      {pagination && (
        <PaginationControls
          pagination={pagination}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
