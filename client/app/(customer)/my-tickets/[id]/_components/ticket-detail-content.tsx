'use client';

import { TicketDetailContent as SharedTicketDetailContent } from '@/components/ticket-detail';

interface TicketDetailContentProps {
  id: string;
}

export function TicketDetailContent({ id }: TicketDetailContentProps) {
  return (
    <SharedTicketDetailContent
      id={id}
      backHref="/my-tickets"
      backLabel="Back to My Tickets"
      viewerRole="customer"
    />
  );
}
