'use client'

import { useState } from 'react'
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
}

export function AdminBulkActionBar({
  actions,
  selection,
  selectedCount,
  onApplied,
  onClearSelection,
}: AdminBulkActionBarProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  if (selectedCount === 0 || actions.length === 0) {
    return null
  }

  const runAction = async (action: BulkAction) => {
    setPendingKey(action.key)
    try {
      const result = await action.onApply(selection)
      onApplied?.(result)
      if (result.failed.length === 0) {
        onClearSelection?.()
      }
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
      <p className="font-medium">{selectedCount} selected</p>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => void runAction(action)}
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
