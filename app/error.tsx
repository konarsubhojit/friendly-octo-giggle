"use client";

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

const GlobalError = ({ error, reset }: ErrorProps) => {
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Something went wrong!
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          {error.message || "An unexpected error occurred"}
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
export default GlobalError;
