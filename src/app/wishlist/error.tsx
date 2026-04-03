"use client";

import Link from "next/link";

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function WishlistError({ error, reset }: ErrorProps) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--accent-cream)] rounded-2xl shadow-warm-lg border border-[var(--border-warm)] p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent-peach)]/30 flex items-center justify-center">
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
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Wishlist Error
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          {error.message || "Something went wrong loading your wishlist"}
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white font-bold rounded-full hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] transition-all shadow-warm hover:shadow-warm-lg focus-warm"
          >
            Try again
          </button>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-6 py-2.5 border border-[var(--border-warm)] rounded-full text-[var(--foreground)] font-semibold hover:bg-[var(--accent-blush)] transition-colors"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
