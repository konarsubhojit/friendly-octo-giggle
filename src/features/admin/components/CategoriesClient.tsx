'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { RESOURCE_FORM_PRESENTATIONS } from '@/features/admin/services/form-presentation-rule'
import FormErrorSummary from '@/features/admin/components/FormErrorSummary'
import { useUnsavedChangesGuard } from '@/features/admin/hooks/useUnsavedChangesGuard'

// FR-B02/FR-B03: categories are a low-field-count record, so the canonical
// rule places create/edit in an overlay rather than a dedicated screen.
const CATEGORY_FORM_PRESENTATION = RESOURCE_FORM_PRESENTATIONS.categories

interface Category {
  id: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

interface CategoriesClientProps {
  readonly initialCategories: Category[]
}

const reorder = <T,>(list: T[], from: number, to: number): T[] => {
  if (from === to) return list
  const result = [...list]
  const [moved] = result.splice(from, 1)
  result.splice(to, 0, moved)
  return result
}

const GripIcon = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="5" cy="4" r="1.2" />
    <circle cx="5" cy="8" r="1.2" />
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="11" cy="4" r="1.2" />
    <circle cx="11" cy="8" r="1.2" />
    <circle cx="11" cy="12" r="1.2" />
  </svg>
)

interface CategoryRowProps {
  readonly cat: Category
  readonly index: number
  readonly isDragOver: boolean
  readonly isDragging: boolean
  readonly saving: boolean
  readonly onDragStart: (index: number) => void
  readonly onDragOver: (e: React.DragEvent, index: number) => void
  readonly onDrop: (index: number) => void
  readonly onDragEnd: () => void
  readonly onEditClick: (cat: Category) => void
  readonly onDeleteClick: (cat: Category) => void
}

const CategoryRow = ({
  cat,
  index,
  isDragOver,
  isDragging,
  saving,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEditClick,
  onDeleteClick,
}: CategoryRowProps) => {
  let dragStateClass: string
  if (isDragging) {
    dragStateClass =
      'opacity-40 shadow-inner bg-slate-50 dark:bg-slate-800/40 border-dashed border-slate-300 dark:border-slate-600'
  } else if (isDragOver) {
    dragStateClass =
      'border-sky-400 bg-sky-50/60 dark:bg-sky-900/20 shadow-md scale-[1.01]'
  } else {
    dragStateClass =
      'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
  }

  return (
    <li
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={[
        'group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150 select-none',
        dragStateClass,
      ].join(' ')}
      aria-label={`Category: ${cat.name}. Drag to reorder.`}
    >
      <span
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors"
        aria-hidden="true"
      >
        <GripIcon />
      </span>

      <span className="flex-shrink-0 w-6 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onEditClick(cat)}
          title="Click to edit"
          className="w-full text-left text-sm font-medium text-slate-900 dark:text-slate-100 truncate hover:text-sky-600 dark:hover:text-sky-400 transition-colors focus:outline-none focus-visible:underline"
        >
          {cat.name}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onDeleteClick(cat)}
        disabled={saving}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-30"
        aria-label={`Delete ${cat.name}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M6 7h12m-9 0V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7m-7.5 0l.75 11.25A1.5 1.5 0 009.75 19.5h4.5a1.5 1.5 0 001.5-1.25L16.5 7m-6 3v5m3-5v5"
          />
        </svg>
      </button>
    </li>
  )
}

interface CategoryFormModalProps {
  readonly editingCategory: Category | null
  readonly onClose: () => void
  readonly onSubmit: (
    name: string
  ) => Promise<{ success: boolean; error?: string; stale?: boolean }>
}

/**
 * Overlay create/edit form for categories (FR-B02/FR-B03). Rendered for both
 * "add" (editingCategory === null) and "edit" (editingCategory set) flows.
 */
const CategoryFormModal = ({
  editingCategory,
  onClose,
  onSubmit,
}: CategoryFormModalProps) => {
  const isEditing = editingCategory !== null
  const [name, setName] = useState(editingCategory?.name ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { guardClose } = useUnsavedChangesGuard(dirty)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleClose = () => guardClose(onClose)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setFormError(null)
    setStale(false)
    const result = await onSubmit(trimmed)
    setSubmitting(false)
    if (result.success) {
      onClose()
    } else if (result.stale) {
      setStale(true)
    } else if (result.error) {
      setFormError(result.error)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-form-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full">
        <form onSubmit={handleSubmit} className="p-6">
          <h3
            id="category-form-title"
            className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4"
          >
            {isEditing ? 'Edit Category' : 'Add Category'}
          </h3>
          {stale && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              This category was changed by someone else since this form
              opened. Reload and try again.
            </p>
          )}
          <FormErrorSummary formError={formError} />
          <label
            htmlFor="category-form-name"
            className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-1"
          >
            Name
          </label>
          <input
            id="category-form-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setDirty(true)
            }}
            placeholder="e.g. Handbag"
            maxLength={100}
            required
            disabled={submitting}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-950 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const CategoriesClient = ({ initialCategories }: CategoriesClientProps) => {
  const [cats, setCats] = useState<Category[]>(initialCategories)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formTarget, setFormTarget] = useState<Category | 'new' | null>(null)

  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleCreate = async (
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create category')
      const created = data.data?.category ?? data.category
      setCats((prev) =>
        [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder)
      )
      toast.success(`"${created.name}" added`)
      return { success: true }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create category'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const handleRename = async (
    category: Category,
    name: string
  ): Promise<{ success: boolean; error?: string; stale?: boolean }> => {
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          expectedUpdatedAt: category.updatedAt,
        }),
      })
      const data = await res.json()
      if (res.status === 409) {
        const message =
          data.details?.reason === 'stale'
            ? 'This category was changed by someone else. Reload and try again.'
            : (data.error ?? 'A category with this name already exists')
        toast.error(message)
        return {
          success: false,
          error: message,
          stale: data.details?.reason === 'stale',
        }
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to rename category')
      const updated = data.data?.category ?? data.category
      setCats((prev) => prev.map((c) => (c.id === category.id ? updated : c)))
      toast.success(`Renamed to "${updated.name}"`)
      return { success: true }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to rename category'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const handleFormSubmit = async (
    name: string
  ): Promise<{ success: boolean; error?: string; stale?: boolean }> => {
    if (formTarget === 'new') return handleCreate(name)
    if (formTarget) return handleRename(formTarget, name)
    return { success: false }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to delete category')
      }
      setCats((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      toast.success(`"${deleteTarget.name}" deleted`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete category'
      )
    } finally {
      setDeleteTarget(null)
      setDeleteLoading(false)
    }
  }

  const handleDragStart = (index: number) => {
    setDragSourceIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragSourceIndex !== index) setDragOverIndex(index)
  }

  const handleDrop = async (targetIndex: number) => {
    const sourceIndex = dragSourceIndex
    setDragSourceIndex(null)
    setDragOverIndex(null)
    if (sourceIndex === null || sourceIndex === targetIndex) return

    const reordered = reorder(cats, sourceIndex, targetIndex).map(
      (cat, idx) => ({
        ...cat,
        sortOrder: idx,
      })
    )
    const previous = cats
    setCats(reordered)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: reordered.map(({ id, sortOrder }) => ({ id, sortOrder })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to save order')
      }
      toast.success('Order saved')
    } catch (err) {
      setCats(previous)
      toast.error(err instanceof Error ? err.message : 'Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  const handleDragEnd = () => {
    setDragSourceIndex(null)
    setDragOverIndex(null)
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Categories
          </h3>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            New categories are automatically placed at the end. Drag rows to
            reorder.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormTarget('new')}
          aria-label="Add category"
          className="px-4 py-2 text-sm font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition whitespace-nowrap"
        >
          + Add Category
        </button>
      </div>

      {cats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/50 p-10 text-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            No categories yet
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Add your first category above.
          </p>
        </div>
      ) : (
        <>
          {saving && (
            <output className="mb-2 text-xs text-slate-400 flex items-center gap-1.5">
              <svg
                className="animate-spin w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving order…
            </output>
          )}
          <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
            Drag{' '}
            <span aria-hidden="true" className="font-mono">
              ⠿
            </span>{' '}
            to reorder · click a name to edit
          </p>
          <ul
            className="space-y-2 list-none p-0"
            aria-label="Categories — drag to reorder"
          >
            {cats.map((cat, index) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                index={index}
                isDragOver={dragOverIndex === index}
                isDragging={dragSourceIndex === index}
                saving={saving}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onEditClick={setFormTarget}
                onDeleteClick={setDeleteTarget}
              />
            ))}
          </ul>
        </>
      )}

      {formTarget !== null && CATEGORY_FORM_PRESENTATION === 'overlay' && (
        <CategoryFormModal
          editingCategory={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Products using this category won't be affected, but the category will no longer appear in filters and forms.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

export default CategoriesClient
