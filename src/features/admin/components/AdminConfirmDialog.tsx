'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

export type ConfirmOutcome =
  | { status: 'success' }
  | { status: 'partial'; succeeded: number; failed: number }
  | { status: 'failure'; reason: string }

export interface AdminConfirmDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly description: string
  readonly reversible: boolean
  readonly typedConfirmationValue?: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly variant?: 'danger' | 'warning' | 'info'
  readonly onConfirm: () => Promise<ConfirmOutcome>
}

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const getOutcomeMessage = (outcome: ConfirmOutcome) => {
  if (outcome.status === 'success') {
    return 'Action completed successfully.'
  }

  if (outcome.status === 'partial') {
    return `${outcome.succeeded} completed, ${outcome.failed} failed.`
  }

  return outcome.reason
}

const getButtonClass = (variant: NonNullable<AdminConfirmDialogProps['variant']>) =>
  ({
    danger: 'bg-red-600 hover:bg-red-700 disabled:bg-red-400',
    warning: 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400',
    info: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400',
  })[variant]

export function AdminConfirmDialog({
  open,
  onClose,
  title,
  description,
  reversible,
  typedConfirmationValue,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
}: AdminConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState<ConfirmOutcome | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const id = useId()

  const handleClose = useCallback(() => {
    setTypedValue('')
    setLoading(false)
    setOutcome(null)
    onClose()
    lastFocusedRef.current?.focus()
  }, [onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    lastFocusedRef.current = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        handleClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = dialogRef.current
      if (!dialog) {
        return
      }

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      )
      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable.at(-1) as HTMLElement

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose, loading, open])

  if (!open) {
    return null
  }

  const typedConfirmationSatisfied =
    typedConfirmationValue === undefined || typedValue === typedConfirmationValue

  const submit = async () => {
    setLoading(true)
    try {
      setOutcome(await onConfirm())
    } finally {
      setLoading(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      open
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id={`${id}-title`}
              className="text-lg font-semibold text-slate-950 dark:text-slate-100"
            >
              {title}
            </h2>
            <p
              id={`${id}-description`}
              className="mt-2 text-sm text-slate-600 dark:text-slate-300"
            >
              {description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            disabled={loading}
            aria-label="Close confirmation dialog"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60 dark:hover:bg-slate-900 dark:hover:text-slate-100"
          >
            ×
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {reversible ? 'This action can be reversed later.' : 'This action cannot be reversed.'}
        </p>

        {typedConfirmationValue ? (
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Type <span className="font-semibold">{typedConfirmationValue}</span> to
            continue
            <input
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        ) : null}

        {outcome ? (
          <p
            className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-live="polite"
          >
            {getOutcomeMessage(outcome)}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
          >
            {outcome ? 'Close' : cancelLabel}
          </button>
          {!outcome ? (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={loading || !typedConfirmationSatisfied}
              className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition ${getButtonClass(variant)}`}
            >
              {loading ? 'Working…' : confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  )
}

export default AdminConfirmDialog
