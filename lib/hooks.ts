'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Generic hook for fetching data with TypeScript
export function useFetch<T>(
  url: string,
  options?: RequestInit
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const json = await response.json();
      setData(json.data || json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

// Hook for mutations with optimistic updates
export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
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
        setError(err instanceof Error ? err.message : 'Mutation failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn]
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
  initialState: T
): {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  handleChange: (name: keyof T, value: unknown) => void;
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => (e: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
  setError: (name: keyof T, error: string) => void;
  reset: () => void;
  isValid: boolean;
} {
  const [values, setValues] = useState<T>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const handleChange = useCallback((name: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, []);

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void | Promise<void>) =>
      async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        await onSubmit(values);
      },
    [values]
  );

  const setError = useCallback((name: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialState);
    setErrors({});
  }, [initialState]);

  const isValid = Object.keys(errors).length === 0;

  return { values, errors, handleChange, handleSubmit, setError, reset, isValid };
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
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (globalThis.window === undefined) {
      return initialValue;
    }

    try {
      const item = globalThis.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = typeof value === 'function' ? (value as (val: T) => T)(storedValue) : value;
      setStoredValue(valueToStore);

      if (globalThis.window !== undefined) {
        globalThis.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };

  return [storedValue, setValue];
}
