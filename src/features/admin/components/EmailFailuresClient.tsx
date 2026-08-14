'use client'

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { AlertBanner } from '@/components/ui/AlertBanner'
import type { EmailAttemptRecord } from '@/lib/schema'
import { Badge, type DataTableColumn } from 'zenput'
import { AdminDataView } from '@/features/admin/components/AdminDataView'
import {
  createEmailFailuresDefinition,
  type EmailFailureRow,
} from '@/features/admin/resources/email-failures'

interface FailedEmailRecord {
  readonly id: string
  readonly recipientEmail: string
  readonly subject: string
  readonly emailType: string
  readonly referenceId: string
  readonly attemptCount: number
  readonly lastError: string | null
  readonly isRetriable: boolean
  readonly status: string
  readonly errorHistory: EmailAttemptRecord[]
  readonly createdAt: Date
  readonly lastAttemptedAt: Date | null
  readonly sentAt: Date | null
}

interface EmailFailuresClientProps {
  readonly initialRecords: FailedEmailRecord[]
}

type RetryApiResponse = {
  success?: boolean
  error?: string
  data?: { results?: Array<{ success?: boolean; error?: string }> }
}

const formatDate = (date: Date | null): string => {
  if (!date) return '—'
  return new Date(date).toLocaleString()
}

const STATUS_TONES = {
  pending: 'warning',
  failed: 'danger',
  sent: 'success',
} as const

type FailedEmailDataRow = EmailFailureRow & {
  readonly referenceId: string
  readonly lastErrorDetail: string | null
  readonly createdAtValue: Date
}

interface EmailFailuresTableProps {
  readonly records: FailedEmailRecord[]
  readonly retryingId: string | null
  readonly onRetry: (id: string) => void
}

const toEmailFailureRow = (record: FailedEmailRecord): FailedEmailDataRow => ({
  id: record.id,
  recipient: record.recipientEmail,
  subject: record.subject,
  emailType: record.emailType,
  attempts: String(record.attemptCount),
  status: record.status,
  lastError: record.lastError ?? '—',
  lastErrorDetail: record.lastError,
  createdAt: formatDate(record.createdAt),
  createdAtValue: record.createdAt,
  referenceId: record.referenceId,
})

const EmailFailuresTable = ({
  records,
  retryingId,
  onRetry,
}: EmailFailuresTableProps) => {
  const rows = useMemo<FailedEmailDataRow[]>(
    () => records.map(toEmailFailureRow),
    [records]
  )

  const definition = useMemo(
    () =>
      createEmailFailuresDefinition([], {
        onRetry: (row) => {
          onRetry(row.id)
        },
      }),
    [onRetry]
  )

  const renderRetryButton = useCallback((record: FailedEmailDataRow) => {
    if (definition.rowActions(record).length === 0) {
      return null
    }

    return (
      <button
        type="button"
        onClick={() => onRetry(record.id)}
        disabled={retryingId === record.id}
        className="min-tap rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {retryingId === record.id ? 'Retrying…' : 'Retry'}
      </button>
    )
  }, [definition, onRetry, retryingId])

  const columns = useMemo<DataTableColumn<FailedEmailDataRow>[]>(() => {
    const mergedColumns: DataTableColumn<FailedEmailDataRow>[] =
      definition.columns.map((rawColumn) => {
        const column = rawColumn as unknown as DataTableColumn<FailedEmailDataRow>

        switch (column.key) {
          case 'status':
            return {
              ...column,
              render: (_value: unknown, record: FailedEmailDataRow) => (
                <Badge
                  tone={
                    STATUS_TONES[record.status as keyof typeof STATUS_TONES] ??
                    'neutral'
                  }
                  size="sm"
                >
                  {record.status}
                </Badge>
              ),
            }
          case 'createdAt':
            return {
              ...column,
              render: (_value: unknown, record: FailedEmailDataRow) =>
                formatDate(record.createdAtValue),
            }
          default:
            return column
        }
      })

    const createdAtIndex = mergedColumns.findIndex(
      (column) => column.key === 'createdAt'
    )

    const lastErrorColumn: DataTableColumn<FailedEmailDataRow> = {
      key: 'lastError',
      header: 'Last Error',
      render: (_value, record) => record.lastErrorDetail ?? '—',
    }

    const actionColumn: DataTableColumn<FailedEmailDataRow> = {
      key: 'actions',
      header: 'Action',
      sticky: 'right',
      render: (_value, record) => renderRetryButton(record),
    }

    if (createdAtIndex === -1) {
      return [...mergedColumns, lastErrorColumn, actionColumn]
    }

    return [
      ...mergedColumns.slice(0, createdAtIndex),
      lastErrorColumn,
      ...mergedColumns.slice(createdAtIndex),
      actionColumn,
    ]
  }, [definition, renderRetryButton])

  return (
    <AdminDataView
      ariaLabel="Failed emails"
      definition={{ ...definition, columns }}
      data={rows}
      rowKey={(record) => record.id}
      renderMobileCard={(record) => (
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-all text-sm font-bold text-slate-950 dark:text-slate-50">
                {record.recipient}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {record.emailType}
              </p>
            </div>
            <Badge
              tone={
                STATUS_TONES[record.status as keyof typeof STATUS_TONES] ??
                'neutral'
              }
              size="sm"
            >
              {record.status}
            </Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Order ID
              </dt>
              <dd className="mt-1 break-all font-mono text-slate-700 dark:text-slate-200">
                {record.referenceId}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Attempts
              </dt>
              <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">
                {record.attempts}
              </dd>
            </div>
          </dl>
          {record.lastErrorDetail ? (
            <p className="mt-3 break-words rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {record.lastErrorDetail}
            </p>
          ) : (
            <span className="sr-only">—</span>
          )}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <time className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(record.createdAtValue)}
            </time>
            {renderRetryButton(record)}
          </div>
        </div>
      )}
    />
  )
}

const applyRetryOutcome = (
  result: { success?: boolean; error?: string } | undefined,
  id: string,
  setRecords: Dispatch<SetStateAction<FailedEmailRecord[]>>,
  setError: Dispatch<SetStateAction<string | null>>
): void => {
  if (result?.success) {
    setRecords((prev) => prev.filter((r) => r.id !== id))
  } else {
    setError(result?.error ?? 'Retry failed')
  }
}

const handleRetryResponse = (
  res: Response,
  data: RetryApiResponse,
  id: string,
  setRecords: Dispatch<SetStateAction<FailedEmailRecord[]>>,
  setError: Dispatch<SetStateAction<string | null>>
): void => {
  if (!res.ok || !data.success) {
    setError(data.error ?? 'Retry failed')
    return
  }
  applyRetryOutcome(data.data?.results?.[0], id, setRecords, setError)
}

export const EmailFailuresClient = ({
  initialRecords,
}: EmailFailuresClientProps) => {
  const [records, setRecords] = useState<FailedEmailRecord[]>(initialRecords)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRetry = async (id: string) => {
    setRetryingId(id)
    setError(null)
    try {
      const res = await fetch('/api/admin/email-failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      const data = (await res.json()) as RetryApiResponse
      handleRetryResponse(res, data, id, setRecords, setError)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div>
      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}
      {records.length === 0 ? (
        <EmptyState
          title="No failed emails"
          message="All emails have been delivered successfully."
        />
      ) : (
        <EmailFailuresTable
          records={records}
          retryingId={retryingId}
          onRetry={handleRetry}
        />
      )}
    </div>
  )
}
