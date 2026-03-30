'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Product } from '@shared/types/product';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const fetchedRef = useRef(false);

  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const data = await apiClient.get<Product>(`/products/${id}`);
      setProduct(data);
    } catch (error) {
      setHasError(true);
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Failed to load product. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchProduct();
  }, [fetchProduct]);

  const retry = useCallback(() => {
    fetchedRef.current = false;
    fetchProduct();
  }, [fetchProduct]);

  return { product, isLoading, hasError, retry };
}
