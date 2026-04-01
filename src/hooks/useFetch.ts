"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
