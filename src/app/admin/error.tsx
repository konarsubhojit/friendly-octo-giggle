'use client'

import Link from 'next/link'

interface ErrorProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function AdminError({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/92 p-8 text-center shadow-[0_28px_80px_-42px_rgba(15,23,42,0.55)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_28px_80px_-42px_rgba(2,6,23,0.92)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60">
          <svg
            className="h-8 w-8 text-rose-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-600">
          Admin route failure
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">
          Admin Panel Error
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
          {error.message || 'An error occurred in the admin panel'}
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
          >
            Admin home
          </Link>
        </div>
      </div>
    </div>
  )
}
