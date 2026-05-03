'use client'

import { useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

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
  readonly onRename: (id: string, name: string) => Promise<void>
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
  onRename,
  onDeleteClick,
}: CategoryRowProps) => {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(cat.name)
  const [renameSaving, setRenameSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setDraftName(cat.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraftName(cat.name)
  }

  const commitEdit = async () => {
    const trimmed = draftName.trim()
    if (!trimmed || trimmed === cat.name) {
      cancelEdit()
      return
    }
    setRenameSaving(true)
    await onRename(cat.id, trimmed)
    setEditing(false)
    setRenameSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={[
        'group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150 select-none',
        isDragging
          ? 'opacity-40 shadow-inner bg-slate-50 dark:bg-slate-800/40 border-dashed border-slate-300 dark:border-slate-600'
          : isDragOver
            ? 'border-sky-400 bg-sky-50/60 dark:bg-sky-900/20 shadow-md scale-[1.01]'
            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600',
      ].join(' ')}
      role="listitem"
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
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            maxLength={100}
            disabled={renameSaving}
            autoFocus
            className="w-full px-2 py-0.5 rounded border border-sky-400 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Edit category name"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to rename"
            className="w-full text-left text-sm font-medium text-slate-900 dark:text-slate-100 truncate hover:text-sky-600 dark:hover:text-sky-400 transition-colors focus:outline-none focus-visible:underline"
          >
            {cat.name}
          </button>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-slate-400">
          {renameSaving ? (
            <span>Saving…</span>
          ) : (
            <>
              <kbd className="px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                ↵
              </kbd>
              <span>save</span>
              <kbd className="ml-1 px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                Esc
              </kbd>
              <span>cancel</span>
            </>
          )}
        </div>
      )}

      {!editing && (
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
      )}
    </div>
  )
}

const CategoriesClient = ({ initialCategories }: CategoriesClientProps) => {
  const [cats, setCats] = useState<Category[]>(initialCategories)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleAdd = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    setAddLoading(true)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create category')
      const created = data.data?.category ?? data.category
      setCats((prev) =>
        [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder)
      )
      setNewName('')
      toast.success(`"${created.name}" added`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create category'
      )
    } finally {
      setAddLoading(false)
    }
  }

  const handleRename = useCallback(async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to rename category')
      const updated = data.data?.category ?? data.category
      setCats((prev) => prev.map((c) => (c.id === id ? updated : c)))
      toast.success(`Renamed to "${updated.name}"`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to rename category'
      )
    }
  }, [])

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

  const handleDragStart = useCallback((index: number) => {
    setDragSourceIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragSourceIndex !== index) setDragOverIndex(index)
  }, [dragSourceIndex])

  const handleDrop = useCallback(
    async (targetIndex: number) => {
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
    },
    [cats, dragSourceIndex]
  )

  const handleDragEnd = useCallback(() => {
    setDragSourceIndex(null)
    setDragOverIndex(null)
  }, [])

  return (
    <>
      <form
        onSubmit={handleAdd}
        className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5"
      >
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Add Category
        </h3>
        <div className="flex gap-3">
          <input
            id="new-cat-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Handbag"
            maxLength={100}
            required
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="New category name"
          />
          <button
            type="submit"
            disabled={addLoading || !newName.trim()}
            aria-label="Add category"
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-950 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition whitespace-nowrap"
          >
            {addLoading ? 'Adding…' : '+ Add'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          New categories are automatically placed at the end. Drag rows to
          reorder.
        </p>
      </form>

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
            <p
              className="mb-2 text-xs text-slate-400 flex items-center gap-1.5"
              role="status"
            >
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
            </p>
          )}
          <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
            Drag{' '}
            <span aria-hidden="true" className="font-mono">
              ⠿
            </span>{' '}
            to reorder · click a name to rename
          </p>
          <div
            className="space-y-2"
            role="list"
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
                onRename={handleRename}
                onDeleteClick={setDeleteTarget}
              />
            ))}
          </div>
        </>
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
