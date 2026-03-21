"use client";

interface StarRatingProps {
  readonly rating: number;
  readonly maxStars?: number;
  readonly size?: "sm" | "md" | "lg";
  readonly interactive?: boolean;
  readonly onChange?: (rating: number) => void;
  readonly label?: string;
}

const SIZE_CLASS = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-7 h-7",
} as const;

export const StarRating = ({
  rating,
  maxStars = 5,
  size = "md",
  interactive = false,
  onChange,
  label,
}: StarRatingProps) => {
  const sizeClass = SIZE_CLASS[size];

  const stars = Array.from({ length: maxStars }, (_, i) => {
    const starValue = i + 1;
    const filled = starValue <= rating;

    if (interactive) {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(starValue)}
          aria-label={`${starValue} star${starValue === 1 ? "" : "s"}`}
          aria-pressed={filled}
          className={`${sizeClass} transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-rose)] rounded`}
        >
          <svg
            viewBox="0 0 24 24"
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={filled ? 0 : 1.5}
            className={filled ? "text-amber-400" : "text-[var(--text-muted)]"}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      );
    }

    return (
      <svg
        key={i}
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.5}
        className={`${sizeClass} ${filled ? "text-amber-400" : "text-[var(--text-muted)]"}`}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    );
  });

  if (interactive) {
    return (
      <fieldset className="flex items-center gap-0.5 border-none p-0 m-0">
        <legend className="sr-only">{label ?? `Rate out of ${maxStars} stars`}</legend>
        {stars}
      </fieldset>
    );
  }

  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={label ?? `Rating: ${rating} out of ${maxStars} stars`}
    >
      {stars}
    </div>
  );
};
