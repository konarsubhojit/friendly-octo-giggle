"use client";

interface CursorPaginationBarProps {
  readonly currentPage: number;
  readonly totalCount: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly totalPages: number;
  readonly onFirst: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onLast: () => void;
  readonly onPageSelect: (page: number) => void;
  readonly variant?: "warm" | "default";
}

export const CursorPaginationBar = ({
  currentPage,
  totalCount,
  pageSize,
  hasMore,
  loading,
  totalPages,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onPageSelect,
  variant = "default",
}: CursorPaginationBarProps) => {
  const isWarm = variant === "warm";
  const safeTotalPages = Math.max(1, totalPages);
  const canGoBack = currentPage > 1;
  const canGoForward = hasMore && currentPage < safeTotalPages;
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd =
    totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);

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

  const jumpClass = isWarm
    ? "border border-[var(--border-warm)] bg-[var(--surface)] text-[var(--text-secondary)] rounded-full"
    : "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md";

  return (
    <div
      className={`flex flex-col gap-3 border-t ${borderClass} pt-4 lg:flex-row lg:items-center lg:justify-between`}
    >
      <div className="flex items-center gap-2 self-start lg:self-auto">
        <button
          onClick={onFirst}
          disabled={!canGoBack || loading}
          className={`px-4 py-2 text-sm font-medium ${prevClass} disabled:opacity-40 disabled:cursor-not-allowed transition`}
        >
          « First
        </button>
        <button
          onClick={onPrev}
          disabled={!canGoBack || loading}
          className={`px-4 py-2 text-sm font-medium ${prevClass} disabled:opacity-40 disabled:cursor-not-allowed transition`}
        >
          ← Previous
        </button>
      </div>

      <div className="flex flex-col items-start gap-2 lg:items-center">
        <p className={`text-sm ${pageTextClass}`}>
          Showing {rangeStart}-{rangeEnd} of {totalCount}
        </p>
        <label className={`flex items-center gap-2 text-sm ${pageTextClass}`}>
          <span>Jump to page</span>
          <select
            value={currentPage}
            onChange={(event) => {
              const page = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(page)) {
                onPageSelect(page);
              }
            }}
            disabled={loading || safeTotalPages <= 1}
            className={`px-3 py-2 text-sm font-medium ${jumpClass} disabled:opacity-40 disabled:cursor-not-allowed transition`}
            aria-label="Jump to page"
          >
            {Array.from({ length: safeTotalPages }, (_, index) => {
              const page = index + 1;
              return (
                <option key={page} value={page}>
                  Page {page} of {safeTotalPages}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2 self-start lg:self-auto">
        <button
          onClick={onNext}
          disabled={!canGoForward || loading}
          className={`px-4 py-2 text-sm font-medium ${nextClass} disabled:opacity-40 disabled:cursor-not-allowed transition`}
        >
          Next →
        </button>
        <button
          onClick={onLast}
          disabled={!canGoForward || loading}
          className={`px-4 py-2 text-sm font-medium ${nextClass} disabled:opacity-40 disabled:cursor-not-allowed transition`}
        >
          Last »
        </button>
      </div>
    </div>
  );
};
