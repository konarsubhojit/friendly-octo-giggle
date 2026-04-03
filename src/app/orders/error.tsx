'use client'

import Link from 'next/link'

interface ErrorProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function OrdersError({ error, reset }: ErrorProps) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-2xl shadow-warm-lg border border-[var(--border-warm)] p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent-blush)] flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[var(--accent-rose)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Error Loading Orders
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          {error.message || 'Failed to load your order information'}
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white font-medium rounded-full hover:opacity-90 transition-all shadow-warm focus-warm"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-[var(--accent-blush)] text-[var(--text-secondary)] font-medium rounded-full hover:bg-[var(--accent-cream)] transition-all border border-[var(--border-warm)] focus-warm"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
