export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Ticket {id}</h1>
      <p className="mt-2 text-muted-foreground">
        Ticket detail with admin actions coming soon.
      </p>
    </div>
  );
}
