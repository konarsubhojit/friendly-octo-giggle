"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
} from "react";
import { logError } from "@/lib/logger";

// Generic hook for fetching data with TypeScript
export function useFetch<T>(
  url: string,
  options?: RequestInit,
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, optionsRef.current);

      if (response.ok) {
        const json = await response.json();
        setData(json.data || json);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // fetchData handles all errors internally via try/catch and sets error state
    fetchData().catch(() => {
      /* no-op: errors handled inside fetchData */
    });
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData().catch(() => {
      /* no-op: errors handled inside fetchData */
    });
  }, [fetchData]);

  return { data, loading, error, refetch };
}

// Hook for mutations with optimistic updates
export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
): {
  mutate: (variables: TVariables) => Promise<void>;
  loading: boolean;
  error: string | null;
  data: TData | null;
  reset: () => void;
} {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Mutation failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { mutate, loading, error, data, reset };
}

// Hook for form state management with TypeScript
export function useFormState<T extends Record<string, unknown>>(
  initialState: T,
): {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  handleChange: (name: keyof T, value: unknown) => void;
  handleSubmit: (
    onSubmit: (values: T) => void | Promise<void>,
  ) => (e: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
  setError: (name: keyof T, error: string) => void;
  reset: () => void;
  isValid: boolean;
} {
  const [values, setValues] = useState<T>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const handleChange = useCallback((name: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const { [name]: _removed, ...rest } = prev;
      return rest as Partial<Record<keyof T, string>>;
    });
  }, []);

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void | Promise<void>) =>
      async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        await onSubmit(values);
      },
    [values],
  );

  const setError = useCallback((name: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialState);
    setErrors({});
  }, [initialState]);

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    handleChange,
    handleSubmit,
    setError,
    reset,
    isValid,
  };
}

// Hook for debouncing values
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Hook for local storage with TypeScript
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (globalThis.window === undefined) {
      return initialValue;
    }

    try {
      const item = globalThis.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logError({ error, context: "useLocalStorage:read" });
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        typeof value === "function"
          ? (value as (val: T) => T)(storedValue)
          : value;
      setStoredValue(valueToStore);

      if (globalThis.window !== undefined) {
        globalThis.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      logError({ error, context: "useLocalStorage:write" });
    }
  };

  return [storedValue, setValue];
}

// ─── Recently Viewed Hook ────────────────────────────────

const RECENTLY_VIEWED_KEY = "kiyon_recently_viewed";
const RECENTLY_VIEWED_MAX = 12;

export interface RecentlyViewedProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  category: string;
  viewedAt: number;
}

/**
 * Tracks recently viewed products in localStorage.
 * Stores up to RECENTLY_VIEWED_MAX items, most recent first.
 */
export function useRecentlyViewed(): {
  recentlyViewed: RecentlyViewedProduct[];
  trackProduct: (product: RecentlyViewedProduct) => void;
  clearHistory: () => void;
} {
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage<
    RecentlyViewedProduct[]
  >(RECENTLY_VIEWED_KEY, []);

  const trackProduct = useCallback(
    (product: RecentlyViewedProduct) => {
      setRecentlyViewed((prev) => {
        // Remove existing entry for same product
        const filtered = prev.filter((p) => p.id !== product.id);
        // Add to front, cap at max
        return [{ ...product, viewedAt: Date.now() }, ...filtered].slice(
          0,
          RECENTLY_VIEWED_MAX,
        );
      });
    },
    [setRecentlyViewed],
  );

  const clearHistory = useCallback(() => {
    setRecentlyViewed([]);
  }, [setRecentlyViewed]);

  return { recentlyViewed, trackProduct, clearHistory };
}

// ─── Modal State Hook ────────────────────────────────────

/**
 * Generic hook for managing modal open/close state with an optional
 * data payload (e.g. the item being edited or deleted).
 *
 * Usage:
 *   const editModal = useModalState<Product>();
 *   editModal.open(product)   // opens with data
 *   editModal.close()         // closes and clears data
 *   editModal.isOpen          // boolean
 *   editModal.data            // T | null
 */
export function useModalState<T = undefined>(): {
  isOpen: boolean;
  data: T | null;
  open: (data?: T) => void;
  close: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const open = useCallback((payload?: T) => {
    setData(payload ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  return { isOpen, data, open, close };
}

export interface UseCursorPaginationOptions<T> {
  readonly url: string;
  readonly pageSize?: number;
  readonly dataKey: string;
  readonly enabled?: boolean;
  readonly transform?: (item: T) => T;
}

export interface UseCursorPaginationResult<T> {
  readonly items: T[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly search: string;
  readonly searchInput: string;
  readonly hasMore: boolean;
  readonly cursorHistoryLength: number;
  readonly currentPage: number;
  readonly setSearchInput: Dispatch<SetStateAction<string>>;
  readonly handleSearch: (e: FormEvent<HTMLFormElement>) => void;
  readonly handleNext: () => void;
  readonly handlePrev: () => void;
  readonly handleRefresh: () => void;
}

const DEFAULT_CURSOR_PAGE_SIZE = 20;

const buildPaginatedUrl = (
  base: string,
  cursor: string | null,
  search: string,
  size: number,
): string => {
  const params = new URLSearchParams({ limit: String(size) });
  if (cursor) params.set("cursor", cursor);
  if (search) params.set("search", search);
  return `${base}?${params.toString()}`;
};

const extractPaginatedResponse = <T>(
  raw: Record<string, unknown>,
  key: string,
): { items: T[]; nextCursor: string | null; hasMore: boolean } => {
  const wrapper = (raw.data ?? raw) as Record<string, unknown>;
  return {
    items: (wrapper[key] ?? []) as T[],
    nextCursor: (wrapper.nextCursor as string | null) ?? null,
    hasMore: (wrapper.hasMore as boolean) ?? false,
  };
};

export const useCursorPagination = <T>({
  url,
  pageSize = DEFAULT_CURSOR_PAGE_SIZE,
  dataKey,
  enabled = true,
  transform,
}: UseCursorPaginationOptions<T>): UseCursorPaginationResult<T> => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const transformRef = useRef(transform);
  transformRef.current = transform;

  const doFetch = useCallback(
    async (cursorValue: string | null, searchQuery: string) => {
      setLoading(true);
      setError(null);
      try {
        const fetchUrl = buildPaginatedUrl(
          url,
          cursorValue,
          searchQuery,
          pageSize,
        );
        const res = await fetch(fetchUrl);
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as Record<
            string,
            unknown
          >;
          throw new Error(
            (errData.error as string) || `Failed to load ${dataKey}`,
          );
        }
        const raw = (await res.json()) as Record<string, unknown>;
        const {
          items: pageItems,
          nextCursor: nextCur,
          hasMore: more,
        } = extractPaginatedResponse<T>(raw, dataKey);
        const applyTransform = transformRef.current;
        setItems(applyTransform ? pageItems.map(applyTransform) : pageItems);
        setNextCursor(nextCur);
        setHasMore(more);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [url, pageSize, dataKey],
  );

  useEffect(() => {
    if (enabled) {
      doFetch(cursor, search);
    }
  }, [enabled, cursor, search, doFetch]);

  const handleSearch = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setCursor(null);
      setCursorHistory([]);
      setSearch(searchInput.trim());
    },
    [searchInput],
  );

  const handleNext = useCallback(() => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor ?? ""]);
    setCursor(nextCursor);
  }, [nextCursor, cursor]);

  const handlePrev = useCallback(() => {
    if (cursorHistory.length === 0) return;
    const history = [...cursorHistory];
    const prevCursor = history.pop() ?? null;
    setCursorHistory(history);
    setCursor(prevCursor);
  }, [cursorHistory]);

  const handleRefresh = useCallback(() => {
    setCursor(null);
    setCursorHistory([]);
    setSearch("");
    setSearchInput("");
  }, []);

  return {
    items,
    loading,
    error,
    search,
    searchInput,
    hasMore,
    cursorHistoryLength: cursorHistory.length,
    currentPage: cursorHistory.length + 1,
    setSearchInput,
    handleSearch,
    handleNext,
    handlePrev,
    handleRefresh,
  };
};
