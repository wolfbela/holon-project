'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProduct } from '@/hooks/use-product';
import { ProductDetailSkeleton } from './product-detail-skeleton';
import { ProductImageGallery } from './product-image-gallery';
import { ProductInfo } from './product-info';
import { CreateTicketModal } from './create-ticket-modal';

interface ProductDetailContentProps {
  id: string;
}

export function ProductDetailContent({ id }: ProductDetailContentProps) {
  const { product, isLoading, hasError, retry } = useProduct(id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (hasError || !product) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <p className="text-lg font-medium text-foreground">
          Something went wrong
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn&apos;t load this product. Please try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2 rounded-full"
          onClick={retry}
        >
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="grid gap-8 lg:grid-cols-2"
      >
        <ProductImageGallery images={product.images} title={product.title} />
        <ProductInfo product={product} onCreateTicket={() => setIsModalOpen(true)} />
      </motion.div>

      <CreateTicketModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        productId={product.id}
        productName={product.title}
      />
    </div>
  );
}
