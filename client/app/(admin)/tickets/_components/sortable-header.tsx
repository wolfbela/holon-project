'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { SortField, SortOrder } from '@/hooks/use-admin-tickets';
import { TableHead } from '@/components/ui/table';

interface SortableHeaderProps {
  label: string;
  sortKey: SortField;
  currentSort: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
}: SortableHeaderProps) {
  const isActive = currentSort === sortKey;

  return (
    <TableHead
      className="cursor-pointer select-none transition-colors hover:text-foreground"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {isActive ? (
          currentOrder === 'asc' ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
        )}
      </span>
    </TableHead>
  );
}
