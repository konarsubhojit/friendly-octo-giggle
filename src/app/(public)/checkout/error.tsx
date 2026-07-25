'use client'

import { RouteErrorCard } from '@/components/ui/RouteErrorCard'

interface ErrorProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function CheckoutError({ error, reset }: ErrorProps) {
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Checkout Error"
      fallbackMessage="Something went wrong during checkout"
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      }
      secondaryHref="/cart"
      secondaryLabel="Back to cart"
    />
  )
}
