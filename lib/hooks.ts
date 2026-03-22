"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { logError } from "@/lib/logger";

export const useFetch = <T>(
  url: string,
  options?: RequestInit,
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} => {
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
};

export const useMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
): {
  mutate: (variables: TVariables) => Promise<void>;
  loading: boolean;
  error: string | null;
  data: TData | null;
  reset: () => void;
} => {
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
};

export const useFormState = <T extends Record<string, unknown>>(
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
} => {
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
};

export const useDebounce = <T>(value: T, delay: number): T => {
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
};

export const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] => {
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
};

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

export const useRecentlyViewed = (): {
  recentlyViewed: RecentlyViewedProduct[];
  trackProduct: (product: RecentlyViewedProduct) => void;
  clearHistory: () => void;
} => {
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
};

// ─── Modal State Hook ────────────────────────────────────

export const useModalState = <T = undefined>(): {
  isOpen: boolean;
  data: T | null;
  open: (data?: T) => void;
  close: () => void;
} => {
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
};

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
  readonly currentPage: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly setSearchInput: Dispatch<SetStateAction<string>>;
  readonly handleSearch: (e: React.BaseSyntheticEvent) => void;
  readonly handleFirst: () => void;
  readonly handleNext: () => void;
  readonly handlePrev: () => void;
  readonly handleLast: () => void;
  readonly handlePageSelect: (page: number) => void;
  readonly handleRefresh: () => void;
}

const DEFAULT_CURSOR_PAGE_SIZE = 10;

const buildPaginatedUrl = (
  base: string,
  cursor: string | null,
  search: string,
  size: number,
  offset?: number,
): string => {
  const params = new URLSearchParams({ limit: String(size) });
  if (offset !== undefined && offset > 0) {
    params.set("offset", String(offset));
  } else if (cursor) {
    params.set("cursor", cursor);
  }
  if (search) params.set("search", search);
  return `${base}?${params.toString()}`;
};

const extractPaginatedResponse = <T>(
  raw: Record<string, unknown>,
  key: string,
): {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
} => {
  const wrapper = (raw.data ?? raw) as Record<string, unknown>;
  return {
    items: (wrapper[key] ?? []) as T[],
    nextCursor: (wrapper.nextCursor as string | null) ?? null,
    hasMore: (wrapper.hasMore as boolean) ?? false,
    totalCount: Number(wrapper.totalCount ?? 0),
  };
};

type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const transformRef = useRef(transform);
  const pageCursorsRef = useRef<Array<string | null>>([null]);
  const pendingOffsetRef = useRef<number | null>(null);
  const pendingPaginationRequestsRef = useRef<
    Map<string, Promise<PaginatedResponse<T>>>
  >(new Map());
  transformRef.current = transform;

  const syncPageCursors = useCallback((nextValue: Array<string | null>) => {
    pageCursorsRef.current = nextValue;
  }, []);

  const fetchPageData = useCallback(
    async (
      cursorValue: string | null,
      searchQuery: string,
      offset?: number,
    ) => {
      const fetchUrl = buildPaginatedUrl(
        url,
        cursorValue,
        searchQuery,
        pageSize,
        offset,
      );
      const requestKey = `${dataKey}:${fetchUrl}`;
      const pendingPaginationRequests = pendingPaginationRequestsRef.current;
      const existingRequest = pendingPaginationRequests.get(requestKey);
      if (existingRequest) {
        return existingRequest;
      }

      const requestPromise = (async () => {
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
        return extractPaginatedResponse<T>(raw, dataKey);
      })();

      pendingPaginationRequests.set(requestKey, requestPromise);

      try {
        return await requestPromise;
      } finally {
        pendingPaginationRequests.delete(requestKey);
      }
    },
    [url, pageSize, dataKey],
  );

  const doFetch = useCallback(
    async (
      cursorValue: string | null,
      searchQuery: string,
      pageNumber: number,
      offsetVal?: number,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const {
          items: pageItems,
          nextCursor: nextCur,
          hasMore: more,
          totalCount: total,
        } = await fetchPageData(cursorValue, searchQuery, offsetVal);
        const applyTransform = transformRef.current;
        setItems(applyTransform ? pageItems.map(applyTransform) : pageItems);
        setNextCursor(nextCur);
        setHasMore(more);
        setTotalCount(total);
        const nextKnownCursors = pageCursorsRef.current.slice(0, pageNumber);
        if (nextCur) {
          nextKnownCursors[pageNumber] = nextCur;
        }
        syncPageCursors(nextKnownCursors);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [fetchPageData, syncPageCursors],
  );

  useEffect(() => {
    if (!enabled) return;

    const pendingOffset = pendingOffsetRef.current;
    pendingOffsetRef.current = null;

    doFetch(
      pendingOffset === null ? cursor : null,
      search,
      currentPage,
      pendingOffset ?? undefined,
    );
  }, [enabled, cursor, search, currentPage, doFetch]);

  const trailingPageCount = hasMore ? 1 : 0;
  const totalPages =
    totalCount > 0
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : currentPage + trailingPageCount;

  const handleSearch = useCallback(
    (e: React.BaseSyntheticEvent) => {
      e.preventDefault();
      syncPageCursors([null]);
      setCurrentPage(1);
      setCursor(null);
      setSearch(searchInput.trim());
    },
    [searchInput, syncPageCursors],
  );

  const handleFirst = useCallback(() => {
    if (currentPage === 1) return;
    setCurrentPage(1);
    setCursor(null);
  }, [currentPage]);

  const handleNext = useCallback(() => {
    if (!nextCursor || !hasMore) return;
    setCurrentPage((prev) => prev + 1);
    setCursor(nextCursor);
  }, [hasMore, nextCursor]);

  const handlePrev = useCallback(() => {
    if (currentPage === 1) return;

    const prevCursor = pageCursorsRef.current[currentPage - 2];
    if (prevCursor === undefined) {
      pendingOffsetRef.current = (currentPage - 2) * pageSize;
      setCurrentPage((prev) => prev - 1);
      return;
    }

    setCurrentPage((prev) => prev - 1);
    setCursor(prevCursor);
  }, [currentPage, pageSize]);

  const handlePageSelect = useCallback(
    (page: number) => {
      const targetPage = Math.min(Math.max(1, page), totalPages);
      if (targetPage === currentPage) return;

      if (targetPage === 1) {
        handleFirst();
        return;
      }

      const knownCursor = pageCursorsRef.current[targetPage - 1];
      if (knownCursor === undefined) {
        pendingOffsetRef.current = (targetPage - 1) * pageSize;
        setCurrentPage(targetPage);
        return;
      }

      setCurrentPage(targetPage);
      setCursor(knownCursor);
    },
    [currentPage, handleFirst, pageSize, totalPages],
  );

  const handleLast = useCallback(() => {
    handlePageSelect(totalPages);
  }, [handlePageSelect, totalPages]);

  const handleRefresh = useCallback(() => {
    syncPageCursors([null]);
    setCurrentPage(1);
    setTotalCount(0);
    setCursor(null);
    setNextCursor(null);
    setHasMore(false);
    setSearch("");
    setSearchInput("");
  }, [syncPageCursors]);

  return {
    items,
    loading,
    error,
    search,
    searchInput,
    hasMore,
    currentPage,
    totalCount,
    totalPages,
    setSearchInput,
    handleSearch,
    handleFirst,
    handleNext,
    handlePrev,
    handleLast,
    handlePageSelect,
    handleRefresh,
  };
};
