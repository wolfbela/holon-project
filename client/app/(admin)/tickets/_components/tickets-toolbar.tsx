'use client';

import { Search, X } from 'lucide-react';
import type { TicketStatus, TicketPriority } from '@shared/types/ticket';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface TicketsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: TicketStatus | undefined;
  onStatusChange: (value: TicketStatus | undefined) => void;
  priority: TicketPriority | undefined;
  onPriorityChange: (value: TicketPriority | undefined) => void;
}

export function TicketsToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
}: TicketsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search tickets"
          placeholder="Search by subject or customer name..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
            onClick={() => onSearchChange('')}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Select
          value={status ?? 'all'}
          onValueChange={(v) =>
            onStatusChange(v === 'all' ? undefined : (v as TicketStatus))
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={priority ?? 'all'}
          onValueChange={(v) =>
            onPriorityChange(v === 'all' ? undefined : (v as TicketPriority))
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
