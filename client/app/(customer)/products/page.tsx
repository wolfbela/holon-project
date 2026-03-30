'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <p className="text-lg font-medium text-foreground">
            Something went wrong
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We couldn&apos;t load the products. Please try again.
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
