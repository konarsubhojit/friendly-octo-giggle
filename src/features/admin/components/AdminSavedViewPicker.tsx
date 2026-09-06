'use client'

import type {
  AdminResourceKey,
  SavedViewCriteria,
} from '@/lib/validations/admin'
import { useSavedViews } from '@/features/admin/hooks/useSavedViews'

interface AdminSavedViewPickerProps {
  readonly resource: AdminResourceKey
  readonly activeViewId?: string | null
  readonly onSelectView: (
    viewId: string | null,
    criteria?: SavedViewCriteria
  ) => void
  readonly className?: string
}

export function AdminSavedViewPicker({
  resource,
  activeViewId = null,
  onSelectView,
  className,
}: AdminSavedViewPickerProps) {
  const { views, loading } = useSavedViews(resource)

  return (
    <label
      className={`flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 ${className ?? ''}`}
    >
      <span>View</span>
      <select
        aria-label={`${resource} saved view`}
        value={activeViewId ?? ''}
        onChange={(event) => {
          const nextId = event.target.value || null
          const nextView = views.find((view) => view.id === nextId)
          onSelectView(nextId, nextView?.criteria)
        }}
        disabled={loading}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        <option value="">Current filters</option>
        {views.map((view) => (
          <option key={view.id} value={view.id}>
            {view.name}
          </option>
        ))}
      </select>
    </label>
  )
}
