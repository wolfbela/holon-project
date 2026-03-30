export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Product {id}</h1>
      <p className="mt-2 text-muted-foreground">
        Product detail page coming soon.
      </p>
    </div>
  );
}
