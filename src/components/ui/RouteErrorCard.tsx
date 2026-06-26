'use client'

import type { ReactNode } from 'react'
import Link from '@/components/ui/LocaleLink'

interface RouteErrorCardProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
  /** Heading rendered inside the card (e.g. "Error Loading Cart"). */
  readonly title: string
  /** Fallback body text shown when `error.message` is empty. */
  readonly fallbackMessage: string
  /** SVG or other icon element placed inside the themed icon circle. */
  readonly icon?: ReactNode
  /** href for the optional secondary action link. Requires `secondaryLabel`. */
  readonly secondaryHref?: string
  /** Label for the optional secondary action link. Requires `secondaryHref`. */
  readonly secondaryLabel?: string
  /**
   * Visual variant:
   * - `'public'` (default) — warm storefront theme using CSS custom properties.
   * - `'admin'`  — slate / rose design with dark-mode support for the admin panel.
   */
  readonly variant?: 'public' | 'admin'
  /** Eyebrow label rendered above the title (admin variant only). */
  readonly label?: string
}

/**
 * Full-page error card used by Next.js route `error.tsx` boundaries.
 *
 * Usage (public route):
 * ```tsx
 * export default function CartError({ error, reset }: ErrorProps) {
 *   return (
 *     <RouteErrorCard
 *       error={error}
 *       reset={reset}
 *       title="Error Loading Cart"
 *       fallbackMessage="Failed to load your shopping cart"
 *       secondaryHref="/products"
 *       secondaryLabel="Continue shopping"
 *     />
 *   )
 * }
 * ```
 */
export function RouteErrorCard({
  error,
  reset,
  title,
  fallbackMessage,
  icon,
  secondaryHref,
  secondaryLabel,
  variant = 'public',
  label,
}: RouteErrorCardProps) {
  const message = error.message || fallbackMessage
  const showSecondary = Boolean(secondaryHref && secondaryLabel)

  if (variant === 'admin') {
    return (
      <div className="flex min-h-[55vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/92 p-8 text-center shadow-[0_28px_80px_-42px_rgba(15,23,42,0.55)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_28px_80px_-42px_rgba(2,6,23,0.92)]">
          {icon && (
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60">
              {icon}
            </div>
          )}
          {label && (
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-600">
              {label}
            </p>
          )}
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            {message}
          </p>
          {error.digest && (
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              Error ID: {error.digest}
            </p>
          )}
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Try again
            </button>
            {showSecondary && (
              <Link
                href={secondaryHref!}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Default: public warm storefront theme
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--accent-cream)] rounded-2xl shadow-warm-lg border border-[var(--border-warm)] p-8 text-center">
        {icon && (
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent-peach)]/30 flex items-center justify-center">
            {icon}
          </div>
        )}
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          {title}
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">{message}</p>
        {error.digest && (
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white font-bold rounded-full hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] transition-all shadow-warm hover:shadow-warm-lg focus-warm"
          >
            Try again
          </button>
          {showSecondary && (
            <Link
              href={secondaryHref!}
              className="inline-flex items-center justify-center px-6 py-2.5 border border-[var(--border-warm)] rounded-full text-[var(--foreground)] font-semibold hover:bg-[var(--accent-blush)] transition-colors focus-warm"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
