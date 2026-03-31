import { TicketDetailContent } from './_components/ticket-detail-content';

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketDetailContent id={id} />;
}
