'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

interface UseFetchOptions<T> {
  /** The async function that fetches data */
  fetcher: () => Promise<T>;
  /** Dependencies that should trigger a re-fetch when changed */
  deps?: unknown[];
  /** Error message shown in toast on failure. Set to null to silently fail. */
  errorMessage?: string | null;
  /** Whether to track the HTTP error status code */
  trackErrorStatus?: boolean;
}

interface UseFetchResult<T> {
  data: T;
  isLoading: boolean;
  hasError: boolean;
  errorStatus: number | null;
  retry: () => void;
  /** Directly set the data (useful for optimistic updates) */
  setData: React.Dispatch<React.SetStateAction<T>>;
}

export function useFetch<T>({
  fetcher,
  deps = [],
  errorMessage = 'Something went wrong. Please try again.',
  trackErrorStatus = false,
}: UseFetchOptions<T>): UseFetchResult<T> {
  const [data, setData] = useState<T>(undefined as T);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const fetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    if (trackErrorStatus) setErrorStatus(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (error) {
      setHasError(true);
      if (trackErrorStatus && error instanceof ApiClientError) {
        setErrorStatus(error.status);
      }
      if (errorMessage !== null) {
        if (error instanceof ApiClientError) {
          toast.error(error.body.error);
        } else {
          toast.error(errorMessage);
        }
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher]);

  // Reset fetch guard when deps change
  useEffect(() => {
    fetchedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    fetchedRef.current = false;
    fetchData();
  }, [fetchData]);

  return { data, isLoading, hasError, errorStatus, retry, setData };
}
