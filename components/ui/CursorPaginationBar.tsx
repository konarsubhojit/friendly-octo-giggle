"use client";

interface CursorPaginationBarProps {
  readonly currentPage: number;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly cursorHistoryLength: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly variant?: "warm" | "default";
}

export const CursorPaginationBar = ({
  currentPage,
  hasMore,
  loading,
  cursorHistoryLength,
  onPrev,
  onNext,
  variant = "default",
}: CursorPaginationBarProps) => {
  const isWarm = variant === "warm";

  const borderClass = isWarm
    ? "border-[var(--border-warm)]"
    : "border-gray-200 dark:border-gray-700";

  const pageTextClass = isWarm
    ? "text-[var(--text-muted)]"
    : "text-gray-600 dark:text-gray-400";

  const prevClass = isWarm
    ? "bg-[var(--surface)] border border-[var(--border-warm)] text-[var(--text-secondary)] rounded-full hover:bg-[var(--border-warm)]"
    : "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600";

  const nextClass = isWarm
    ? "bg-[var(--accent-rose)] text-white rounded-full hover:opacity-90"
    : "bg-blue-600 text-white rounded-md hover:bg-blue-700";

  return (
    <div
      className={`flex items-center justify-between border-t ${borderClass} pt-4`}
    >
      <p className={`text-sm ${pageTextClass}`}>Page {currentPage}</p>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={cursorHistoryLength === 0 || loading}
          className={`px-4 py-2 text-sm font-medium ${prevClass} disabled:opacity-40 disabled:cursor-not-allowed transition`}
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasMore || loading}
          className={`px-4 py-2 text-sm font-medium ${nextClass} disabled:opacity-40 disabled:cursor-not-allowed transition`}
        >
          Next →
        </button>
      </div>
    </div>
  );
};
