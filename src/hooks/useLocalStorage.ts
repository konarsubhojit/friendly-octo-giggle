"use client";

import { useState } from "react";
import { logError } from "@/lib/logger";

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
