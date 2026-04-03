"use client";

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function AccountError({ error, reset }: ErrorProps) {
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Account Error
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          {error.message || "Something went wrong loading your account"}
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white font-bold rounded-full hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] transition-all shadow-warm hover:shadow-warm-lg focus-warm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
