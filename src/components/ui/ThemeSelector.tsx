'use client'

import { useTheme } from '@/contexts/ThemeContext'

export const ThemeSelector = () => {
  const { theme, setTheme, themes } = useTheme()
  const activeTheme =
    themes.find((option) => option.id === theme) ??
    themes.find((option) => option.id === 'default') ??
    themes[0]

  return (
    <label className="flex w-full items-center gap-2 text-[var(--foreground)] sm:w-auto">
      <span className="sr-only">Select colour theme</span>
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border-warm)] shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${activeTheme.bgPreview} 0%, ${activeTheme.accentPreview} 100%)`,
        }}
        aria-hidden="true"
      />
      <select
        value={theme}
        onChange={(e) =>
          setTheme(e.target.value as (typeof themes)[number]['id'])
        }
        className="w-full flex-1 cursor-pointer appearance-none rounded-md border border-[var(--border-warm)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)] sm:w-52 sm:flex-none"
        aria-label="Select colour theme"
      >
        {themes.map((themeOption) => (
          <option key={themeOption.id} value={themeOption.id}>
            {themeOption.label}
          </option>
        ))}
      </select>
      <span className="hidden text-xs text-[var(--text-muted)] md:inline">
        {activeTheme.description}
      </span>
    </label>
  )
}
