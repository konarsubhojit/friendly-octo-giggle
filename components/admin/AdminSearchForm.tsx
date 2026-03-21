"use client";

import type { Dispatch, SetStateAction } from "react";

interface AdminSearchFormProps {
  readonly searchInput: string;
  readonly setSearchInput: Dispatch<SetStateAction<string>>;
  readonly search: string;
  readonly onSearch: (e: React.BaseSyntheticEvent) => void;
  readonly onClear: () => void;
  readonly placeholder?: string;
  readonly ariaLabel?: string;
}

export const AdminSearchForm = ({
  searchInput,
  setSearchInput,
  search,
  onSearch,
  onClear,
  placeholder = "Search\u2026",
  ariaLabel = "Search",
}: AdminSearchFormProps) => (
  <form onSubmit={onSearch} className="mb-6">
    <div className="flex gap-2 max-w-md">
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
          placeholder={placeholder}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={ariaLabel}
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
      >
        Search
      </button>
      {search && (
        <button
          type="button"
          onClick={onClear}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          Clear
        </button>
      )}
    </div>
    {search && (
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Showing results for &ldquo;<strong>{search}</strong>&rdquo;
      </p>
    )}
  </form>
);
