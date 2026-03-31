'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ErrorRetry } from '@/components/error-retry';
import { useProducts } from '@/hooks/use-products';
import { CategoryFilter } from './_components/category-filter';
import { ProductGrid } from './_components/product-grid';

export default function ProductsPage() {
  const { products, isLoading, hasError, retry } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category.name))].sort(),
    [products],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      counts[p.category.name] = (counts[p.category.name] || 0) + 1;
    }
    return counts;
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      selectedCategory
        ? products.filter((p) => p.category.name === selectedCategory)
        : products,
    [products, selectedCategory],
  );

  const resetFilters = useCallback(() => setSelectedCategory(null), []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="mt-1 text-muted-foreground">
          Browse our catalog and create support tickets for any product.
        </p>
      </motion.div>

      {!isLoading && !hasError && categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mt-6"
        >
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            counts={categoryCounts}
          />
        </motion.div>
      )}

      {hasError && !isLoading ? (
        <ErrorRetry
          message="We couldn't load the products. Please try again."
          onRetry={retry}
        />
      ) : (
        <div className="mt-6">
          <ProductGrid
            products={filteredProducts}
            isLoading={isLoading}
            totalCount={products.length}
            onResetFilters={resetFilters}
          />
        </div>
      )}
    </div>
  );
}
