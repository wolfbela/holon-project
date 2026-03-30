import { ProductDetailContent } from './_components/product-detail-content';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProductDetailContent id={id} />;
}
