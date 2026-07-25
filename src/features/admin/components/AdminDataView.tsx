'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  DataTable,
  Pagination,
  SkeletonCard,
  type DataTableColumn,
} from 'zenput'

interface AdminDataPagination {
  readonly currentPage: number
  readonly pageSize: number
  readonly totalCount: number
  readonly onPageChange: (page: number) => void
}

interface AdminDataViewProps<T extends Record<string, unknown>> {
  readonly ariaLabel: string
  readonly columns: DataTableColumn<T>[]
  readonly data: T[]
  readonly rowKey: (row: T, index: number) => string | number
  readonly renderMobileCard: (row: T) => ReactNode
  readonly loading?: boolean
  readonly skeletonRowCount?: number
  readonly emptyMessage?: string
  readonly pagination?: AdminDataPagination
  readonly expandedRowRender?: (row: T) => ReactNode
}

const MOBILE_QUERY = '(max-width: 767px)'

export function AdminDataView<T extends Record<string, unknown>>({
  ariaLabel,
  columns,
  data,
  rowKey,
  renderMobileCard,
  loading = false,
  skeletonRowCount = 5,
  emptyMessage = 'No records found.',
  pagination,
  expandedRowRender,
}: AdminDataViewProps<T>) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return

    const mediaQuery = globalThis.matchMedia(MOBILE_QUERY)
    const updateViewport = () => setIsMobile(mediaQuery.matches)

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  if (!isMobile) {
    return (
      <div className="min-w-0 overflow-hidden" aria-label={ariaLabel}>
        <DataTable
          className="admin-data-table"
          columns={columns}
          data={data}
          rowKey={rowKey}
          loading={loading}
          skeletonRowCount={skeletonRowCount}
          serverSide
          emptyMessage={emptyMessage}
          pagination={pagination}
          expandedRowRender={expandedRowRender}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid gap-3" aria-label={`${ariaLabel} loading`}>
        {Array.from({ length: Math.min(skeletonRowCount, 5) }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="min-w-0" aria-label={ariaLabel}>
      <div className="grid gap-3" role="list">
        {data.map((row, index) => (
          <article
            key={rowKey(row, index)}
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
            role="listitem"
          >
            {renderMobileCard(row)}
          </article>
        ))}
      </div>
      {pagination ? (
        <Pagination
          {...pagination}
          size="sm"
          disabled={loading}
          className="mt-5 overflow-x-auto pb-1"
        />
      ) : null}
    </div>
  )
}
