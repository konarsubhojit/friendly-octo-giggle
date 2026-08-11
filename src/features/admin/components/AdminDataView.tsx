'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DataTable,
  Pagination,
  SkeletonCard,
  type DataTableColumn,
} from 'zenput'
import { AdminBulkActionBar } from './AdminBulkActionBar'
import type { ResourceListDefinition } from './resource-list-definition'

interface AdminDataPagination {
  readonly currentPage: number
  readonly pageSize: number
  readonly totalCount: number
  readonly onPageChange: (page: number) => void
}

type AdminDataViewState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'empty'; message?: string }
  | { status: 'filtered-empty'; message?: string }
  | { status: 'error'; message: string; onRetry?: () => void }

interface AdminFilterChip {
  readonly key: string
  readonly label: string
  readonly value: string
}

export interface AdminDataViewSelectionContext<
  T extends Record<string, unknown>,
> {
  readonly selectedRowIds: readonly (string | number)[]
  readonly selectedRows: readonly T[]
  readonly clearSelection: () => void
}

interface AdminDataViewProps<T extends Record<string, unknown>> {
  readonly ariaLabel: string
  readonly columns?: DataTableColumn<T>[]
  readonly definition?: ResourceListDefinition<T>
  readonly data: T[]
  readonly rowKey: (row: T, index: number) => string | number
  readonly renderMobileCard: (row: T) => ReactNode
  readonly loading?: boolean
  readonly skeletonRowCount?: number
  readonly emptyMessage?: string
  readonly pagination?: AdminDataPagination
  readonly expandedRowRender?: (row: T) => ReactNode
  readonly listState?: AdminDataViewState
  readonly filterChips?: readonly AdminFilterChip[]
  readonly onRemoveFilter?: (key: string) => void
  readonly onClearFilters?: () => void
  readonly renderBulkActionBar?: (
    context: AdminDataViewSelectionContext<T>
  ) => ReactNode
  readonly renderSavedViewPicker?: ReactNode
  readonly renderToolbarEnd?: ReactNode
  readonly activeSortLabel?: string | null
}

const MOBILE_QUERY = '(max-width: 767px)'

const getDerivedState = <T extends Record<string, unknown>>(
  data: T[],
  loading: boolean,
  emptyMessage: string,
  listState?: AdminDataViewState
): AdminDataViewState => {
  if (listState) {
    return listState
  }

  if (loading) {
    return { status: 'loading' }
  }

  if (data.length === 0) {
    return { status: 'empty', message: emptyMessage }
  }

  return { status: 'ready' }
}

const StateMessage = ({
  message,
  action,
}: {
  readonly message: string
  readonly action?: ReactNode
}) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
    <p>{message}</p>
    {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
  </div>
)

const SelectionCheckbox = ({
  checked,
  label,
  onChange,
}: {
  readonly checked: boolean
  readonly label: string
  readonly onChange: () => void
}) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={onChange}
    aria-label={label}
    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
  />
)

export function AdminDataView<T extends Record<string, unknown>>({
  ariaLabel,
  columns,
  definition,
  data,
  rowKey,
  renderMobileCard,
  loading = false,
  skeletonRowCount = 5,
  emptyMessage = 'No records found.',
  pagination,
  expandedRowRender,
  listState,
  filterChips = [],
  onRemoveFilter,
  onClearFilters,
  renderBulkActionBar,
  renderSavedViewPicker,
  renderToolbarEnd,
  activeSortLabel,
}: AdminDataViewProps<T>) {
  const [isMobile, setIsMobile] = useState(false)
  const [selectedRowIds, setSelectedRowIds] = useState<
    ReadonlyArray<string | number>
  >([])

  const resolvedColumns = definition?.columns ?? columns ?? []
  const resolvedState = getDerivedState(data, loading, emptyMessage, listState)
  const selectionEnabled =
    (typeof renderBulkActionBar === 'function' ||
      (definition?.bulkActions.length ?? 0) > 0) &&
    resolvedState.status !== 'loading' &&
    resolvedState.status !== 'error'

  const visibleRowIds = useMemo(
    () => data.map((row, index) => rowKey(row, index)),
    [data, rowKey]
  )

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return

    const mediaQuery = globalThis.matchMedia(MOBILE_QUERY)
    const updateViewport = () => setIsMobile(mediaQuery.matches)

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  useEffect(() => {
    setSelectedRowIds((current) =>
      current.filter((rowId) => visibleRowIds.includes(rowId))
    )
  }, [visibleRowIds])

  const selectedRows = useMemo(
    () =>
      data.filter((row, index) => selectedRowIds.includes(rowKey(row, index))),
    [data, rowKey, selectedRowIds]
  )

  const selectionContext: AdminDataViewSelectionContext<T> = {
    selectedRowIds,
    selectedRows,
    clearSelection: () => setSelectedRowIds([]),
  }

  const toggleRowSelection = (rowId: string | number) => {
    setSelectedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((value) => value !== rowId)
        : [...current, rowId]
    )
  }

  const toggleAllVisibleRows = () => {
    setSelectedRowIds((current) =>
      current.length === visibleRowIds.length ? [] : visibleRowIds
    )
  }

  const tableColumns: DataTableColumn<T>[] = useMemo(() => {
    if (!selectionEnabled) {
      return [...resolvedColumns]
    }

    const selectionColumn: DataTableColumn<T> = {
      key: '__selection__',
      header: (
        <SelectionCheckbox
          checked={
            visibleRowIds.length > 0 && selectedRowIds.length === visibleRowIds.length
          }
          onChange={toggleAllVisibleRows}
          label={`Select all ${ariaLabel.toLowerCase()} on this page`}
        />
      ),
      render: (_value, row) => {
        const rowId = rowKey(row, 0)
        return (
          <SelectionCheckbox
            checked={selectedRowIds.includes(rowId)}
            onChange={() => toggleRowSelection(rowId)}
            label={`Select row ${String(rowId)}`}
          />
        )
      },
    }

    return [selectionColumn, ...resolvedColumns]
  }, [
    ariaLabel,
    resolvedColumns,
    rowKey,
    selectionEnabled,
    selectedRowIds,
    visibleRowIds.length,
  ])

  const toolbar =
    filterChips.length > 0 ||
    renderSavedViewPicker ||
    renderToolbarEnd ||
    activeSortLabel ? (
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {renderSavedViewPicker}
          {activeSortLabel ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Sorted by {activeSortLabel}
            </span>
          ) : null}
          {renderToolbarEnd}
        </div>
        {filterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => onRemoveFilter?.(chip.key)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
                aria-label={`Remove ${chip.label} filter`}
              >
                <span>
                  {chip.label}: {chip.value}
                </span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            {onClearFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-xs font-semibold text-sky-700 underline-offset-4 hover:underline dark:text-sky-300"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null

  const bulkActionBar =
    selectionEnabled && selectedRowIds.length > 0
      ? renderBulkActionBar?.(selectionContext) ?? (
          definition && definition.bulkActions.length > 0 ? (
            <AdminBulkActionBar
              actions={definition.bulkActions}
              selection={{
                scope: 'loaded_page',
                rowIds: selectedRowIds,
              }}
              selectedCount={selectedRowIds.length}
              onClearSelection={selectionContext.clearSelection}
            />
          ) : null
        )
      : null

  const renderEmptyState = () => {
    if (resolvedState.status === 'error') {
      return (
        <StateMessage
          message={resolvedState.message}
          action={
            resolvedState.onRetry ? (
              <button
                type="button"
                onClick={resolvedState.onRetry}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Retry
              </button>
            ) : null
          }
        />
      )
    }

    if (resolvedState.status === 'empty') {
      return <StateMessage message={resolvedState.message ?? emptyMessage} />
    }

    if (resolvedState.status === 'filtered-empty') {
      return (
        <StateMessage
          message={resolvedState.message ?? 'No records match the current filters.'}
        />
      )
    }

    return null
  }

  if (!isMobile) {
    return (
      <div className="min-w-0" aria-label={ariaLabel}>
        {toolbar}
        {bulkActionBar}
        {resolvedState.status === 'loading' ? (
          <div className="grid gap-3" aria-label={`${ariaLabel} loading`}>
            {Array.from({ length: Math.min(skeletonRowCount, 5) }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : resolvedState.status === 'ready' ? (
          <div className="min-w-0 overflow-hidden">
            <DataTable
              className="admin-data-table"
              columns={tableColumns}
              data={data}
              rowKey={rowKey}
              loading={false}
              skeletonRowCount={skeletonRowCount}
              serverSide
              emptyMessage={emptyMessage}
              pagination={pagination}
              expandedRowRender={expandedRowRender}
            />
          </div>
        ) : (
          renderEmptyState()
        )}
      </div>
    )
  }

  if (resolvedState.status === 'loading') {
    return (
      <div className="grid gap-3" aria-label={`${ariaLabel} loading`}>
        {Array.from({ length: Math.min(skeletonRowCount, 5) }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    )
  }

  if (resolvedState.status !== 'ready') {
    return <div aria-label={ariaLabel}>{renderEmptyState()}</div>
  }

  return (
    <div className="min-w-0" aria-label={ariaLabel}>
      {toolbar}
      {bulkActionBar}
      <div className="grid gap-3" role="list">
        {data.map((row, index) => {
          const currentRowId = rowKey(row, index)
          return (
            <article
              key={currentRowId}
              className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
              role="listitem"
            >
              {selectionEnabled ? (
                <div className="mb-3 flex justify-end">
                  <SelectionCheckbox
                    checked={selectedRowIds.includes(currentRowId)}
                    onChange={() => toggleRowSelection(currentRowId)}
                    label={`Select row ${String(currentRowId)}`}
                  />
                </div>
              ) : null}
              {renderMobileCard(row)}
            </article>
          )
        })}
      </div>
      {pagination ? (
        <Pagination
          {...pagination}
          size="sm"
          disabled={resolvedState.status === 'loading'}
          className="mt-5 overflow-x-auto pb-1"
        />
      ) : null}
    </div>
  )
}
