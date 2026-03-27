"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";

export type ThemeId = "default" | "baby-pink";

export interface ThemeOption {
  readonly id: ThemeId;
  readonly label: string;
  readonly description: string;
  readonly bgPreview: string;
  readonly textPreview: string;
}

export const THEMES: readonly ThemeOption[] = [
  {
    id: "default",
    label: "Bloom & Thread",
    description: "Warm cream and terracotta",
    bgPreview: "#FAF5EE",
    textPreview: "#5C4A44",
  },
  {
    id: "baby-pink",
    label: "Baby Pink",
    description: "Soft yellow with baby pink",
    bgPreview: "#FEFCE8",
    textPreview: "#7D3255",
  },
] as const;

const THEME_STORAGE_KEY = "kiyon_theme";

interface ThemeContextValue {
  readonly theme: ThemeId;
  readonly setTheme: (theme: ThemeId) => void;
  readonly themes: readonly ThemeOption[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (globalThis.window === undefined) return "default";
    try {
      const stored = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "baby-pink") return "baby-pink";
    } catch {
      // localStorage unavailable — keep default
    }
    return "default";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "default") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }
  }, [theme]);

  const handleThemeChange = useCallback((next: ThemeId) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable — continue without persistence
    }
    setTheme(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme: handleThemeChange, themes: THEMES }),
    [theme, handleThemeChange],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
};
