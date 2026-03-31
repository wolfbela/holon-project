'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { Ticket } from '@shared/types/ticket';
import type { SortField, SortOrder } from '@/hooks/use-admin-tickets';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge, PriorityBadge } from '@/components/ticket-badges';
import { formatDate } from '@/lib/format';
import { SortableHeader } from './sortable-header';

interface TicketsTableProps {
  tickets: Ticket[];
  sort: SortField;
  order: SortOrder;
  onSort: (field: SortField) => void;
  onDelete: (ticket: Ticket) => void;
}

export function TicketsTable({
  tickets,
  sort,
  order,
  onSort,
  onDelete,
}: TicketsTableProps) {
  const router = useRouter();

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Product</TableHead>
            <SortableHeader
              label="Status"
              sortKey="status"
              currentSort={sort}
              currentOrder={order}
              onSort={onSort}
            />
            <SortableHeader
              label="Priority"
              sortKey="priority"
              currentSort={sort}
              currentOrder={order}
              onSort={onSort}
            />
            <SortableHeader
              label="Date"
              sortKey="created_at"
              currentSort={sort}
              currentOrder={order}
              onSort={onSort}
            />
            <th className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow
              key={ticket.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(`/tickets/${ticket.id}`)}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">
                {ticket.display_id}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{ticket.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ticket.email}
                  </span>
                </div>
              </TableCell>
              <TableCell className="max-w-[200px]">
                <span className="line-clamp-1 text-sm">{ticket.subject}</span>
              </TableCell>
              <TableCell className="max-w-[150px]">
                <span className="line-clamp-1 text-sm text-muted-foreground">
                  {ticket.product_name}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={ticket.status} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={ticket.priority} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(ticket.created_at)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete ticket"
                  title="Delete ticket"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(ticket);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
