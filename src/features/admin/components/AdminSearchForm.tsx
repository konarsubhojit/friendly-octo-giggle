'use client'

import type { Dispatch, SetStateAction } from 'react'

interface AdminSearchFormProps {
  readonly searchInput: string
  readonly setSearchInput: Dispatch<SetStateAction<string>>
  readonly search: string
  readonly onSearch: (e: React.BaseSyntheticEvent) => void
  readonly onClear: () => void
  readonly placeholder?: string
  readonly ariaLabel?: string
}

export const AdminSearchForm = ({
  searchInput,
  setSearchInput,
  search,
  onSearch,
  onClear,
  placeholder = 'Search\u2026',
  ariaLabel = 'Search',
}: AdminSearchFormProps) => (
  <form onSubmit={onSearch} className="space-y-3">
    <div className="flex max-w-2xl flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <svg
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-4 text-sm text-slate-950 shadow-inner shadow-white/40 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-50 dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-slate-900 dark:focus:ring-sky-500/20"
          aria-label={ariaLabel}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          className="inline-flex min-w-[6.5rem] items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
        >
          Search
        </button>
        {search ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-w-[6.5rem] items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
    {search && (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing results for &ldquo;<strong>{search}</strong>&rdquo;
      </p>
    )}
  </form>
)
