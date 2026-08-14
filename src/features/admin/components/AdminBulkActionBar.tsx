'use client'

import { useState } from 'react'
import { AdminConfirmDialog, type ConfirmOutcome } from './AdminConfirmDialog'
import type {
  BulkAction,
  BulkResult,
  BulkSelection,
} from './resource-list-definition'

interface AdminBulkActionBarProps {
  readonly actions: readonly BulkAction[]
  readonly selection: BulkSelection
  readonly selectedCount: number
  readonly onApplied?: (result: BulkResult) => void
  readonly onClearSelection?: () => void
  /**
   * When every row on the current page is selected and more rows exist
   * beyond it, offers an opt-in checkbox (never checked by default, FR-A16)
   * to apply the next bulk action to the entire filtered result set instead
   * of just the loaded page.
   */
  readonly entireFilteredResult?: {
    readonly totalCount: number
    readonly filterSnapshot: Record<string, unknown>
  }
}

const describeResult = (label: string, result: BulkResult): string => {
  if (result.failed.length === 0) {
    return `${label}: completed successfully for ${result.succeeded.length} record(s).`
  }
  return `${label}: ${result.succeeded.length} succeeded, ${result.failed.length} failed.`
}

export function AdminBulkActionBar({
  actions,
  selection,
  selectedCount,
  onApplied,
  onClearSelection,
  entireFilteredResult,
}: AdminBulkActionBarProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null)
  const [applyToEntireResult, setApplyToEntireResult] = useState(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  if (selectedCount === 0 || actions.length === 0) {
    return null
  }

  const effectiveSelection: BulkSelection =
    applyToEntireResult && entireFilteredResult
      ? {
          scope: 'entire_filtered_result',
          filterSnapshot: entireFilteredResult.filterSnapshot,
        }
      : selection

  const runAction = async (action: BulkAction): Promise<BulkResult> => {
    setPendingKey(action.key)
    setAnnouncement(`${action.label}: in progress…`)
    try {
      const result = await action.onApply(effectiveSelection)
      onApplied?.(result)
      setAnnouncement(describeResult(action.label, result))
      if (result.failed.length === 0) {
        setApplyToEntireResult(false)
        onClearSelection?.()
      }
      return result
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Action failed.'
      setAnnouncement(`${action.label} failed: ${reason}`)
      throw error
    } finally {
      setPendingKey(null)
    }
  }

  const handleActionClick = (action: BulkAction) => {
    if (action.requiresTypedConfirmation) {
      setPendingAction(action)
      return
    }
    void runAction(action)
  }

  const handleConfirm = async (): Promise<ConfirmOutcome> => {
    const action = pendingAction
    setPendingAction(null)
    if (!action) {
      return { status: 'failure', reason: 'No pending action.' }
    }

    try {
      const result = await runAction(action)
      if (result.failed.length === 0) {
        return { status: 'success' }
      }
      return {
        status: 'partial',
        succeeded: result.succeeded.length,
        failed: result.failed.length,
      }
    } catch (error) {
      return {
        status: 'failure',
        reason: error instanceof Error ? error.message : 'Action failed.',
      }
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
      {pendingAction ? (
        <AdminConfirmDialog
          open
          onClose={() => setPendingAction(null)}
          title={`${pendingAction.label} ${selectedCount} record(s)`}
          description="This bulk action cannot be undone. Type the confirmation value to proceed."
          reversible={false}
          typedConfirmationValue={pendingAction.key.toUpperCase()}
          confirmLabel={pendingAction.label}
          onConfirm={handleConfirm}
        />
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          {applyToEntireResult && entireFilteredResult
            ? `All ${entireFilteredResult.totalCount} matching records selected`
            : `${selectedCount} selected`}
        </p>
        {entireFilteredResult ? (
          <label className="flex items-center gap-2 text-xs font-medium text-sky-800 dark:text-sky-200">
            <input
              type="checkbox"
              checked={applyToEntireResult}
              onChange={(event) => setApplyToEntireResult(event.target.checked)}
              disabled={pendingKey !== null}
              className="h-3.5 w-3.5 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
            Apply to all {entireFilteredResult.totalCount} matching records
            instead of just this page
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => handleActionClick(action)}
            disabled={pendingKey !== null}
            className="rounded-full border border-sky-300 bg-white px-3 py-1.5 font-semibold text-sky-800 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
          >
            {pendingKey === action.key ? 'Working…' : action.label}
          </button>
        ))}
        {onClearSelection ? (
          <button
            type="button"
            onClick={onClearSelection}
            disabled={pendingKey !== null}
            className="rounded-full px-3 py-1.5 font-semibold text-sky-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-200"
          >
            Clear selection
          </button>
        ) : null}
      </div>
    </div>
  )
}
