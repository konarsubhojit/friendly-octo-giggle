'use client'

import { RouteErrorCard } from '@/components/ui/RouteErrorCard'

interface ErrorProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function WishlistError({ error, reset }: ErrorProps) {
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Wishlist Error"
      fallbackMessage="Something went wrong loading your wishlist"
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
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      }
      secondaryHref="/shop"
      secondaryLabel="Continue shopping"
    />
  )
}
