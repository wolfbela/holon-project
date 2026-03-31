import { AdminTicketDetailContent } from './_components/admin-ticket-detail-content';

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminTicketDetailContent id={id} />;
}
