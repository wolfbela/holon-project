'use client';

import type { TicketStatus } from '@shared/types/ticket';
import { Button } from '@/components/ui/button';

const FILTERS: { label: string; value: TicketStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
];

interface StatusFilterProps {
  selected: TicketStatus | undefined;
  onChange: (status: TicketStatus | undefined) => void;
}

export function StatusFilter({ selected, onChange }: StatusFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {FILTERS.map((filter) => (
        <Button
          key={filter.label}
          size="sm"
          variant={selected === filter.value ? 'default' : 'outline'}
          className="shrink-0 rounded-full"
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
