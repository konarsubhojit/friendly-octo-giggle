'use client'

import { useState } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { AlertBanner } from '@/components/ui/AlertBanner'
import type { EmailAttemptRecord } from '@/lib/schema'
import { Badge, type DataTableColumn } from 'zenput'
import { AdminDataView } from '@/features/admin/components/AdminDataView'

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

type FailedEmailDataRow = FailedEmailRecord & { [key: string]: unknown }

interface EmailFailuresTableProps {
  readonly records: FailedEmailRecord[]
  readonly retryingId: string | null
  readonly onRetry: (id: string) => void
}

const EmailFailuresTable = ({
  records,
  retryingId,
  onRetry,
}: EmailFailuresTableProps) => {
  const rows: FailedEmailDataRow[] = records.map((record) => ({ ...record }))
  const renderRetryButton = (record: FailedEmailDataRow) =>
    record.status !== 'sent' ? (
      <button
        type="button"
        onClick={() => onRetry(record.id)}
        disabled={retryingId === record.id}
        className="min-tap rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {retryingId === record.id ? 'Retrying…' : 'Retry'}
      </button>
    ) : null

  const columns: DataTableColumn<FailedEmailDataRow>[] = [
    { key: 'recipientEmail', header: 'Recipient' },
    { key: 'emailType', header: 'Type' },
    { key: 'referenceId', header: 'Order ID' },
    { key: 'attemptCount', header: 'Attempts', align: 'right' },
    {
      key: 'status',
      header: 'Status',
      render: (_value, record) => (
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
    },
    {
      key: 'lastError',
      header: 'Last Error',
      render: (_value, record) => record.lastError ?? '—',
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (_value, record) => formatDate(record.createdAt),
    },
    {
      key: 'action',
      header: 'Action',
      sticky: 'right',
      render: (_value, record) => renderRetryButton(record),
    },
  ]

  return (
    <AdminDataView
      ariaLabel="Failed emails"
      columns={columns}
      data={rows}
      rowKey={(record) => record.id}
      renderMobileCard={(record) => (
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-all text-sm font-bold text-slate-950 dark:text-slate-50">
                {record.recipientEmail}
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
                {record.attemptCount}
              </dd>
            </div>
          </dl>
          {record.lastError ? (
            <p className="mt-3 break-words rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {record.lastError}
            </p>
          ) : (
            <span className="sr-only">—</span>
          )}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <time className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(record.createdAt)}
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
  setRecords: React.Dispatch<React.SetStateAction<FailedEmailRecord[]>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
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
  setRecords: React.Dispatch<React.SetStateAction<FailedEmailRecord[]>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
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
