import type { Metadata } from 'next'
import Link from 'next/link'

import { RetryButton } from './RetryButton'

export const metadata: Metadata = {
  title: "You're Offline | The Kiyon Store",
  description:
    'No internet connection. Please check your network and try again.',
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-warm-gradient flex flex-col items-center justify-center px-4 text-center">
      {/* Decorative flower */}
      <div className="mb-8 w-24 h-24 rounded-full bg-[var(--accent-blush)] flex items-center justify-center shadow-warm">
        <svg
          className="w-12 h-12 text-[var(--accent-warm)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 8v4l2 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h1 className="text-3xl font-display font-bold italic text-warm-heading mb-3">
        You&rsquo;re Offline
      </h1>
      <p className="text-[var(--text-secondary)] text-lg mb-8 max-w-md leading-relaxed">
        It looks like you&rsquo;ve lost your internet connection. Check your
        network and try again — your cart and wishlist are safely saved.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <RetryButton />
        <Link
          href="/"
          className="min-tap px-6 py-3 rounded-xl border border-[var(--border-warm)] bg-[var(--surface)] text-[var(--text-secondary)] font-semibold hover:bg-[var(--accent-blush)] transition-colors focus-warm flex items-center justify-center"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
