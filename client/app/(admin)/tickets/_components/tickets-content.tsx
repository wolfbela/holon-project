'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { RefreshCw, Ticket as TicketIcon } from 'lucide-react';
import type { Ticket, TicketStatus, TicketPriority } from '@shared/types/ticket';
import type { SortField, SortOrder } from '@/hooks/use-admin-tickets';
import { useAdminTickets } from '@/hooks/use-admin-tickets';
import { useDebounce } from '@/hooks/use-debounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination-controls';
import { TicketsToolbar } from './tickets-toolbar';
import { TicketsTable } from './tickets-table';
import { AdminTicketCard } from './admin-ticket-card';
import { TicketsTableSkeleton, TicketsCardSkeleton } from './tickets-table-skeleton';
import { DeleteTicketDialog } from './delete-ticket-dialog';

export function TicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  // URL-synced state
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState<TicketStatus | undefined>(
    (searchParams.get('status') as TicketStatus) || undefined,
  );
  const [priority, setPriority] = useState<TicketPriority | undefined>(
    (searchParams.get('priority') as TicketPriority) || undefined,
  );
  const [sort, setSort] = useState<SortField>(
    (searchParams.get('sort') as SortField) || 'created_at',
  );
  const [order, setOrder] = useState<SortOrder>(
    (searchParams.get('order') as SortOrder) || 'desc',
  );
  const [page, setPage] = useState(
    Number(searchParams.get('page')) || 1,
  );
  const [limit, setLimit] = useState(
    Number(searchParams.get('limit')) || 10,
  );

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const {
    tickets,
    pagination,
    isLoading,
    hasError,
    retry,
    deleteTicket,
    isDeleting,
  } = useAdminTickets({
    search: debouncedSearch || undefined,
    status,
    priority,
    sort,
    order,
    page,
    limit,
  });

  // Sync state to URL
  const updateURL = useCallback(
    (params: Record<string, string | undefined>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      });
      router.replace(`?${newParams.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      updateURL({ search: value || undefined, page: undefined });
    },
    [updateURL],
  );

  const handleStatusChange = useCallback(
    (value: TicketStatus | undefined) => {
      setStatus(value);
      setPage(1);
      updateURL({ status: value, page: undefined });
    },
    [updateURL],
  );

  const handlePriorityChange = useCallback(
    (value: TicketPriority | undefined) => {
      setPriority(value);
      setPage(1);
      updateURL({ priority: value, page: undefined });
    },
    [updateURL],
  );

  const handleSort = useCallback(
    (field: SortField) => {
      const newOrder = sort === field && order === 'asc' ? 'desc' : 'asc';
      setSort(field);
      setOrder(newOrder);
      setPage(1);
      updateURL({ sort: field, order: newOrder, page: undefined });
    },
    [sort, order, updateURL],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      updateURL({ page: newPage > 1 ? String(newPage) : undefined });
    },
    [updateURL],
  );

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      setLimit(newLimit);
      setPage(1);
      updateURL({ limit: String(newLimit), page: undefined });
    },
    [updateURL],
  );

  const handleDeleteRequest = useCallback((ticket: Ticket) => {
    setDeleteTarget(ticket);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteTicket(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteTicket]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
        <p className="mt-1 text-muted-foreground">
          Manage all customer support tickets.
        </p>
      </motion.div>

      {!hasError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mt-6"
        >
          <TicketsToolbar
            search={search}
            onSearchChange={handleSearchChange}
            status={status}
            onStatusChange={handleStatusChange}
            priority={priority}
            onPriorityChange={handlePriorityChange}
          />
        </motion.div>
      )}

      {hasError && !isLoading ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <p className="text-lg font-medium text-foreground">
            Something went wrong
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We couldn&apos;t load the tickets. Please try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-2 rounded-full"
            onClick={retry}
          >
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </motion.div>
      ) : (
        <div className="mt-6">
          {isLoading ? (
            isMobile ? (
              <TicketsCardSkeleton />
            ) : (
              <TicketsTableSkeleton />
            )
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={TicketIcon}
              title="No tickets found"
              description={
                debouncedSearch || status || priority
                  ? 'Try adjusting your search or filters.'
                  : 'No tickets have been created yet.'
              }
              action={
                (debouncedSearch || status || priority) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setSearch('');
                      setStatus(undefined);
                      setPriority(undefined);
                      setPage(1);
                      updateURL({
                        search: undefined,
                        status: undefined,
                        priority: undefined,
                        page: undefined,
                      });
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <>
              {pagination && (
                <p className="mb-4 text-sm text-muted-foreground">
                  {pagination.total}{' '}
                  {pagination.total === 1 ? 'ticket' : 'tickets'}
                  {status ? ` ${status}` : ''}
                  {priority ? ` (${priority} priority)` : ''}
                </p>
              )}

              {isMobile ? (
                <div className="flex flex-col gap-4">
                  {tickets.map((ticket, index) => (
                    <AdminTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      delay={Math.min(index * 0.05, 0.5)}
                      onDelete={handleDeleteRequest}
                    />
                  ))}
                </div>
              ) : (
                <TicketsTable
                  tickets={tickets}
                  sort={sort}
                  order={order}
                  onSort={handleSort}
                  onDelete={handleDeleteRequest}
                />
              )}

              {pagination && (
                <PaginationControls
                  pagination={pagination}
                  onPageChange={handlePageChange}
                  limit={limit}
                  onLimitChange={handleLimitChange}
                />
              )}
            </>
          )}
        </div>
      )}

      <DeleteTicketDialog
        ticket={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
}
