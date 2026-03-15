interface LoadingSpinnerProps {
  /** Tailwind size class pair, e.g. 'h-8 w-8'. Defaults to 'h-8 w-8'. */
  readonly size?: string;
  /** Tailwind text-color class. Defaults to 'text-blue-600'. */
  readonly color?: string;
  readonly ariaLabel?: string;
}

/**
 * Accessible SVG loading spinner.
 *
 * Usage:
 * ```tsx
 * <LoadingSpinner />
 * <LoadingSpinner size="h-5 w-5" color="text-white" />
 * ```
 */
export function LoadingSpinner({
  size = 'h-8 w-8',
  color = 'text-blue-600',
  ariaLabel = 'Loading',
}: LoadingSpinnerProps) {
  return (
    <svg
      className={`animate-spin ${size} ${color}`}
      fill="none"
      viewBox="0 0 24 24"
      aria-label={ariaLabel}
      role="status"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
