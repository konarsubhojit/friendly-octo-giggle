'use client'

import { useAdminCsvExport } from '@/features/admin/hooks/useAdminCsvExport'
import { AdminExportProgress } from './AdminExportProgress'

interface AdminExportControlProps {
  readonly exportUrl: string
  readonly filenameFallback: string
  readonly idleLabel?: string
}

/**
 * Wires the existing `export/*` CSV routes into a self-contained control
 * that reports progress, completion, and failure without changing the
 * routes' contract (FR-A12 / T013).
 */
export function AdminExportControl({
  exportUrl,
  filenameFallback,
  idleLabel = 'Export CSV',
}: AdminExportControlProps) {
  const { loading, progressLabel, errorMessage, triggerExport } =
    useAdminCsvExport({ exportUrl, filenameFallback })

  return (
    <div className="flex flex-col gap-1">
      <AdminExportProgress
        idleLabel={idleLabel}
        progressLabel={progressLabel}
        loading={loading}
        onExport={triggerExport}
      />
      {errorMessage ? (
        <span
          role="alert"
          className="text-xs font-medium text-red-600 dark:text-red-400"
        >
          {errorMessage}
        </span>
      ) : null}
    </div>
  )
}
