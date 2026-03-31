'use client';

import { useCallback } from 'react';
import type { Product } from '@shared/types/product';
import { apiClient } from '@/lib/api-client';
import { useFetch } from './use-fetch';

export function useProduct(id: string) {
  const fetcher = useCallback(
    () => apiClient.get<Product>(`/products/${id}`),
    [id],
  );

  const {
    data: product,
    isLoading,
    hasError,
    retry,
  } = useFetch({
    fetcher,
    deps: [id],
    errorMessage: null,
  });

  return { product: product ?? null, isLoading, hasError, retry };
}
