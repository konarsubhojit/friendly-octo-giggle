'use client'

import { RouteErrorCard } from '@/components/ui/RouteErrorCard'

interface ErrorProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function AdminError({ error, reset }: ErrorProps) {
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Admin Panel Error"
      fallbackMessage="An error occurred in the admin panel"
      label="Admin route failure"
      icon={
        <svg
          className="h-8 w-8 text-rose-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      }
      variant="admin"
      secondaryHref="/admin"
      secondaryLabel="Admin home"
    />
  )
}
