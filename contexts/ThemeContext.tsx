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

const THEME_IDS = [
  "default",
  "simple",
  "baby-pink",
  "ocean-breeze",
  "midnight-bloom",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

const DEFAULT_THEME_ID: ThemeId = "default";

export interface ThemeOption {
  readonly id: ThemeId;
  readonly label: string;
  readonly description: string;
  readonly bgPreview: string;
  readonly textPreview: string;
  readonly accentPreview: string;
}

export const THEMES: readonly ThemeOption[] = [
  {
    id: "default",
    label: "Bloom & Thread",
    description: "Warm cream and terracotta",
    bgPreview: "#FAF5EE",
    textPreview: "#5C4A44",
    accentPreview: "#C0524A",
  },
  {
    id: "simple",
    label: "Simple Linen",
    description: "Clean stone neutrals with charcoal",
    bgPreview: "#F5F2EC",
    textPreview: "#2F2A26",
    accentPreview: "#5E6C84",
  },
  {
    id: "baby-pink",
    label: "Baby Pink",
    description: "Soft yellow with baby pink",
    bgPreview: "#FEFCE8",
    textPreview: "#7D3255",
    accentPreview: "#C04E72",
  },
  {
    id: "ocean-breeze",
    label: "Ocean Breeze",
    description: "Sea glass blues with coastal sand",
    bgPreview: "#F2FBFD",
    textPreview: "#1F4D57",
    accentPreview: "#0F9FB6",
  },
  {
    id: "midnight-bloom",
    label: "Midnight Bloom",
    description: "Ink navy with neon floral accents",
    bgPreview: "#161A2D",
    textPreview: "#EDF2FF",
    accentPreview: "#D75CF6",
  },
] as const;

const THEME_STORAGE_KEY = "kiyon_theme";

const isThemeId = (value: string | null): value is ThemeId => {
  if (value === null) {
    return false;
  }

  return THEME_IDS.includes(value as ThemeId);
};

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
    if (globalThis.window === undefined) return DEFAULT_THEME_ID;
    try {
      const stored = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeId(stored)) return stored;
    } catch {
      // localStorage unavailable — keep default
    }
    return DEFAULT_THEME_ID;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === DEFAULT_THEME_ID) {
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
