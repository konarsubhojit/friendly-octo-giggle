'use client'

import { RouteErrorCard } from '@/components/ui/RouteErrorCard'

interface ErrorProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function ProductsError({ error, reset }: ErrorProps) {
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Error Loading Products"
      fallbackMessage="Failed to load product information"
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
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      }
      secondaryHref="/"
      secondaryLabel="Go home"
    />
  )
}
