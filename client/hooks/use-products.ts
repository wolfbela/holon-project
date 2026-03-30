'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Product } from '@shared/types/product';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const fetchedRef = useRef(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const data = await apiClient.get<Product[]>('/products');
      setProducts(data);
    } catch (error) {
      setHasError(true);
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Failed to load products. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchProducts();
  }, [fetchProducts]);

  const retry = useCallback(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, hasError, retry };
}
