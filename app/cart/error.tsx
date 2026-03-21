'use client';

import Link from 'next/link';

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

const CartError = ({ error, reset }: ErrorProps) => {

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-2xl shadow-warm-lg border border-[var(--border-warm)] p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent-cream)] flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[var(--accent-sage)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Error Loading Cart
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          {error.message || 'Failed to load your shopping cart'}
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--text-muted)] mb-4">Error ID: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white font-medium rounded-full hover:opacity-90 transition-all shadow-warm focus-warm"
          >
            Try again
          </button>
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-4 py-2 bg-[var(--accent-blush)] text-[var(--text-secondary)] font-medium rounded-full hover:bg-[var(--accent-cream)] transition-all border border-[var(--border-warm)] focus-warm"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
export default CartError;
