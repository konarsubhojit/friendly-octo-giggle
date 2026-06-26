'use client'

import type { ReactNode, SelectHTMLAttributes } from 'react'

interface HeaderSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly children: ReactNode
}

/**
 * Shared select primitive for header-level controls (currency, theme, language).
 * Provides consistent border, focus ring, and disabled token across all selectors.
 *
 * Usage:
 * ```tsx
 * <HeaderSelect value={currency} onChange={handleChange} aria-label="Select currency">
 *   <option value="INR">INR</option>
 *   <option value="USD">USD</option>
 * </HeaderSelect>
 * ```
 */
export function HeaderSelect({
  children,
  className = '',
  ...props
}: Readonly<HeaderSelectProps>) {
  return (
    <select
      className={[
        'cursor-pointer rounded-md border border-[var(--border-warm)] bg-[var(--surface)]',
        'px-3 py-1.5 text-sm text-[var(--foreground)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </select>
  )
}
