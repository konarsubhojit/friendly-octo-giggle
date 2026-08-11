'use client'

interface AdminExportProgressProps {
  readonly idleLabel?: string
  readonly busyLabel?: string
  readonly progressLabel?: string | null
  readonly loading?: boolean
  readonly disabled?: boolean
  readonly onExport: () => void | Promise<void>
}

export function AdminExportProgress({
  idleLabel = 'Export CSV',
  busyLabel = 'Preparing export…',
  progressLabel = null,
  loading = false,
  disabled = false,
  onExport,
}: AdminExportProgressProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void onExport()}
        disabled={disabled || loading}
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        {loading ? busyLabel : idleLabel}
      </button>
      {progressLabel ? (
        <span
          className="text-xs text-slate-500 dark:text-slate-400"
          aria-live="polite"
        >
          {progressLabel}
        </span>
      ) : null}
    </div>
  )
}
