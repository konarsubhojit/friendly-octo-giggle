'use client'

import { RouteErrorCard } from '@/components/ui/RouteErrorCard'

interface ErrorProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function OrdersError({ error, reset }: ErrorProps) {
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Error Loading Orders"
      fallbackMessage="Failed to load your order information"
      icon={
        <svg
          className="w-8 h-8 text-[var(--accent-rose)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      }
      secondaryHref="/"
      secondaryLabel="Go home"
    />
  )
}
