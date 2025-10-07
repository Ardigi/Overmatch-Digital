import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/lib/api';

interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: ApiClientError) => void;
}

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiClientError | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  dependencies: any[] = [],
  options: UseApiOptions = {}
): UseApiReturn<T> {
  const { immediate = false, onSuccess, onError } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(
    async (...args: any[]) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await apiFunction(...args);
        setState({ data: result, loading: false, error: null });
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error =
          err instanceof ApiClientError
            ? err
            : new ApiClientError(err instanceof Error ? err.message : 'An unknown error occurred');
        setState((prev) => ({ ...prev, loading: false, error }));
        onError?.(error);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies.concat([onSuccess, onError])
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, dependencies);

  return {
    ...state,
    execute,
    reset,
  };
}

// Specialized hook for paginated data
interface UsePaginatedApiOptions extends UseApiOptions {
  pageSize?: number;
}

interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UsePaginatedApiReturn<T> extends UseApiState<PaginatedData<T>> {
  execute: (page?: number, filters?: any) => Promise<PaginatedData<T> | null>;
  reset: () => void;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  currentPage: number;
}

export function usePaginatedApi<T = any>(
  apiFunction: (filters: any) => Promise<PaginatedData<T>>,
  initialFilters: any = {},
  options: UsePaginatedApiOptions = {}
): UsePaginatedApiReturn<T> {
  const { pageSize = 20, ...restOptions } = options;
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ ...initialFilters, page: currentPage, pageSize });

  const api = useApi<PaginatedData<T>>(() => apiFunction(filters), [filters], restOptions);

  const execute = useCallback(
    async (page?: number, newFilters?: any) => {
      const updatedFilters = {
        ...filters,
        ...newFilters,
        page: page || currentPage,
        pageSize,
      };
      setFilters(updatedFilters);
      if (page) setCurrentPage(page);
      return api.execute();
    },
    [filters, currentPage, pageSize, api.execute]
  );

  const nextPage = useCallback(() => {
    if (api.data && currentPage < api.data.totalPages) {
      execute(currentPage + 1);
    }
  }, [api.data, currentPage, execute]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      execute(currentPage - 1);
    }
  }, [currentPage, execute]);

  const goToPage = useCallback(
    (page: number) => {
      if (api.data && page >= 1 && page <= api.data.totalPages) {
        execute(page);
      }
    },
    [api.data, execute]
  );

  return {
    ...api,
    execute,
    nextPage,
    prevPage,
    goToPage,
    currentPage,
  };
}

// Hook for mutations (POST, PUT, PATCH, DELETE)
interface UseMutationOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiClientError) => void;
  invalidateQueries?: string[];
}

interface UseMutationReturn<T, V> {
  mutate: (variables: V) => Promise<T | null>;
  mutateAsync: (variables: V) => Promise<T>;
  data: T | null;
  loading: boolean;
  error: ApiClientError | null;
  reset: () => void;
}

export function useMutation<T = any, V = any>(
  mutationFunction: (variables: V) => Promise<T>,
  options: UseMutationOptions<T> = {}
): UseMutationReturn<T, V> {
  const { onSuccess, onError } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(
    async (variables: V) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await mutationFunction(variables);
        setState({ data: result, loading: false, error: null });
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error =
          err instanceof ApiClientError
            ? err
            : new ApiClientError(err instanceof Error ? err.message : 'An unknown error occurred');
        setState((prev) => ({ ...prev, loading: false, error }));
        onError?.(error);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSuccess, onError]
  );

  const mutateAsync = useCallback(
    async (variables: V) => {
      const result = await mutate(variables);
      if (result === null) {
        throw state.error || new Error('Mutation failed');
      }
      return result;
    },
    [mutate, state.error]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    mutate,
    mutateAsync,
    ...state,
    reset,
  };
}
