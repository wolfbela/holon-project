'use client';

import { useCallback } from 'react';
import type { Product } from '@shared/types/product';
import { apiClient } from '@/lib/api-client';
import { useFetch } from './use-fetch';

export function useProducts() {
  const fetcher = useCallback(() => apiClient.get<Product[]>('/products'), []);

  const {
    data: products,
    isLoading,
    hasError,
    retry,
  } = useFetch({
    fetcher,
    errorMessage: 'Failed to load products. Please try again.',
  });

  return { products: products ?? [], isLoading, hasError, retry };
}
