'use client'

interface AdminActivityFiltersValue {
  readonly entity?: string
  readonly action?: string
  readonly actorId?: string
  readonly dateFrom?: string
  readonly dateTo?: string
}

interface AdminActivityFiltersProps {
  readonly value: AdminActivityFiltersValue
  readonly entityOptions: readonly string[]
  readonly actionOptions: readonly string[]
  readonly onChange: (nextValue: AdminActivityFiltersValue) => void
}

export function AdminActivityFilters({
  value,
  entityOptions,
  actionOptions,
  onChange,
}: AdminActivityFiltersProps) {
  const update = (patch: Partial<AdminActivityFiltersValue>) =>
    onChange({ ...value, ...patch })

  return (
    <div className="grid gap-3 md:grid-cols-5">
      <label className="text-sm text-slate-700 dark:text-slate-200">
        <span className="mb-1 block">Entity</span>
        <select
          value={value.entity ?? ''}
          onChange={(event) =>
            update({ entity: event.target.value || undefined })
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">All entities</option>
          {entityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm text-slate-700 dark:text-slate-200">
        <span className="mb-1 block">Action</span>
        <select
          value={value.action ?? ''}
          onChange={(event) =>
            update({ action: event.target.value || undefined })
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">All actions</option>
          {actionOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm text-slate-700 dark:text-slate-200">
        <span className="mb-1 block">Actor</span>
        <input
          type="text"
          value={value.actorId ?? ''}
          onChange={(event) =>
            update({ actorId: event.target.value || undefined })
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <label className="text-sm text-slate-700 dark:text-slate-200">
        <span className="mb-1 block">From</span>
        <input
          type="date"
          value={value.dateFrom ?? ''}
          onChange={(event) =>
            update({ dateFrom: event.target.value || undefined })
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <label className="text-sm text-slate-700 dark:text-slate-200">
        <span className="mb-1 block">To</span>
        <input
          type="date"
          value={value.dateTo ?? ''}
          onChange={(event) =>
            update({ dateTo: event.target.value || undefined })
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
    </div>
  )
}
