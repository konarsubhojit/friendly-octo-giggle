'use client';

import type { FormEvent, Dispatch, SetStateAction } from 'react';

interface OrdersSearchFormProps {
  readonly searchInput: string;
  readonly setSearchInput: Dispatch<SetStateAction<string>>;
  readonly search: string;
  readonly onSearch: (e: FormEvent<HTMLFormElement>) => void;
  readonly onClear: () => void;
}

export const OrdersSearchForm = ({
  searchInput,
  setSearchInput,
  search,
  onSearch,
  onClear,
}: OrdersSearchFormProps) => (
  <form onSubmit={onSearch} className="mb-6">
    <div className="flex gap-2 max-w-md">
      <div className="relative flex-1">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-rose)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="search"
          placeholder="Search by order ID or status…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-11 pr-4 py-3 border border-[var(--border-warm)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30 focus:border-[var(--accent-rose)] bg-[var(--surface)] text-[var(--foreground)] placeholder-[var(--text-muted)] shadow-warm transition-all duration-200"
          aria-label="Search your orders"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-[var(--accent-rose)] text-white rounded-full text-sm hover:opacity-90 transition"
      >
        Search
      </button>
      {search && (
        <button
          type="button"
          onClick={onClear}
          className="px-4 py-2 bg-[var(--surface)] border border-[var(--border-warm)] text-[var(--text-secondary)] rounded-full text-sm hover:bg-[var(--border-warm)] transition"
        >
          Clear
        </button>
      )}
    </div>
    {search && (
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Results for &ldquo;<strong>{search}</strong>&rdquo;
      </p>
    )}
  </form>
);
