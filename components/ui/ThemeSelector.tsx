"use client";

import { useTheme, type ThemeId } from "@/contexts/ThemeContext";

const THEME_SWATCHES: Record<ThemeId, string> = {
  default: "#C0524A",
  "baby-pink": "#C04E72",
};

export const ThemeSelector = () => {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="relative flex items-center">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeId)}
        className="bg-[var(--surface)] border border-[var(--border-warm)] text-[var(--foreground)] rounded-md pl-7 pr-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)] cursor-pointer appearance-none"
        aria-label="Select colour theme"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      {/* Colour swatch preview — positioned inside the select left edge */}
      <span
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-[var(--border-warm)]"
        style={{ backgroundColor: THEME_SWATCHES[theme] }}
        aria-hidden="true"
      />
    </div>
  );
};
