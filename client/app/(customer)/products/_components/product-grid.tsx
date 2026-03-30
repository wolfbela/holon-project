'use client';

import type { Product } from '@shared/types/product';
import { ProductCard } from './product-card';
import { ProductCardSkeleton } from './product-card-skeleton';
import { EmptyState } from './empty-state';

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  totalCount?: number;
  onResetFilters?: () => void;
}

export function ProductGrid({
  products,
  isLoading,
  totalCount,
  onResetFilters,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return <EmptyState onReset={onResetFilters} />;
  }

  return (
    <div>
      {totalCount !== undefined && totalCount !== products.length && (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing {products.length} of {totalCount} products
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            delay={Math.min(index * 0.05, 0.5)}
          />
        ))}
      </div>
    </div>
  );
}
