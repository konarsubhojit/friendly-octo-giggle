"use client";

import Link from "next/link";
import CartGlyph from "@/components/icons/CartGlyph";

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function CartError({ error, reset }: ErrorProps) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-2xl shadow-warm-lg border border-[var(--border-warm)] p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent-cream)] flex items-center justify-center">
          <CartGlyph className="inline-block h-[2.8rem] w-[2.8rem] shrink-0 text-[var(--accent-sage)]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Error Loading Cart
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          {error.message || "Failed to load your shopping cart"}
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
