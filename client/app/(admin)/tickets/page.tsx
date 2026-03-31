import { Suspense } from 'react';
import { TicketsContent } from './_components/tickets-content';

export default function AdminTicketsPage() {
  return (
    <Suspense>
      <TicketsContent />
    </Suspense>
  );
}
