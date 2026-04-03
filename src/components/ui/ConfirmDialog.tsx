'use client'

import { useId, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { DialogBody } from '@/components/ui/DialogBody'

export interface ConfirmDialogProps {
  readonly isOpen: boolean
  readonly title: string
  readonly message: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly variant?: 'danger' | 'warning' | 'info'
  readonly loading?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

const VARIANT_STYLES = {
  danger: {
    iconBg: 'bg-red-100',
    button: 'bg-red-600 hover:bg-red-700 disabled:bg-red-400',
  },
  warning: {
    iconBg: 'bg-yellow-100',
    button: 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400',
  },
  info: {
    iconBg: 'bg-blue-100',
    button: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400',
  },
} as const

const VARIANT_ICONS: Record<string, ReactNode> = {
  danger: (
    <svg
      className="w-6 h-6 text-red-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  warning: (
    <svg
      className="w-6 h-6 text-yellow-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  info: (
    <svg
      className="w-6 h-6 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
}

/** Focusable element selectors for focus-trap cycling. */
const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const uid = useId()
  const titleId = `${uid}-title`
  const messageId = `${uid}-message`

  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const frame = requestAnimationFrame(() => {
      cancelBtnRef.current?.focus()
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialogRef.current?.contains(document.activeElement)) return

      if (e.key === 'Escape' && !loading) {
        onCancel()
        return
      }
      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable.at(-1) as HTMLElement

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, loading, onCancel])

  if (!isOpen) return null

  const styles = VARIANT_STYLES[variant]

  return (
    <dialog
      ref={dialogRef}
      open
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent border-none m-0 w-full max-w-none"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={loading ? undefined : onCancel}
        aria-hidden="true"
      />
      <DialogBody
        titleId={titleId}
        messageId={messageId}
        title={title}
        message={message}
        iconBg={styles.iconBg}
        icon={VARIANT_ICONS[variant]}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        loading={loading}
        buttonClass={styles.button}
        cancelBtnRef={cancelBtnRef}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </dialog>
  )
}

export default ConfirmDialog
