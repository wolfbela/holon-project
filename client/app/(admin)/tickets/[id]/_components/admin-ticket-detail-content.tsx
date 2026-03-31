'use client';

import { TicketDetailContent } from '@/components/ticket-detail';
import { AdminTicketActions } from './admin-ticket-actions';

interface AdminTicketDetailContentProps {
  id: string;
}

export function AdminTicketDetailContent({
  id,
}: AdminTicketDetailContentProps) {
  return (
    <TicketDetailContent
      id={id}
      backHref="/tickets"
      backLabel="Back to Tickets"
      viewerRole="agent"
      showCustomerInfo
      renderActions={(ticket) => <AdminTicketActions ticket={ticket} />}
    />
  );
}
