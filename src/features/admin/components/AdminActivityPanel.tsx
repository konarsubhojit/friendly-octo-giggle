'use client'

import type { ActivityEntry } from '@/features/admin/services/admin-activity-query'

interface AdminActivityPanelProps {
  readonly entries: readonly ActivityEntry[]
  readonly loading?: boolean
  readonly nextCursor?: string | null
  readonly onLoadMore?: () => void
  readonly emptyMessage?: string
}

export function AdminActivityPanel({
  entries,
  loading = false,
  nextCursor = null,
  onLoadMore,
  emptyMessage = 'No activity has been recorded for this resource yet.',
}: AdminActivityPanelProps) {
  if (loading && entries.length === 0) {
    return <p className="text-sm text-slate-500">Loading activity…</p>
  }

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {entry.action}
              </span>
              <span>by {entry.actor.userId}</span>
              {entry.actor.role ? <span>({entry.actor.role})</span> : null}
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString()}
              </time>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              {entry.changes.map((change) => (
                <div
                  key={`${entry.id}-${change.field}`}
                  className="grid gap-1 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900"
                >
                  <dt className="font-medium text-slate-900 dark:text-slate-100">
                    {change.field}
                  </dt>
                  <dd className="text-slate-600 dark:text-slate-300">
                    <span className="font-medium">Before:</span>{' '}
                    {String(change.before ?? '—')}
                  </dd>
                  <dd className="text-slate-600 dark:text-slate-300">
                    <span className="font-medium">After:</span>{' '}
                    {String(change.after ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      {nextCursor && onLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 disabled:opacity-60 dark:border-slate-700 dark:text-slate-100"
        >
          {loading ? 'Loading…' : 'Load more activity'}
        </button>
      ) : null}
    </div>
  )
}
