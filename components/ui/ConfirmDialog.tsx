'use client';

import { useId, useEffect, useRef, type RefObject } from 'react';

export interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: 'danger' | 'warning' | 'info';
  readonly loading?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const VARIANT_STYLES = {
  danger:  { iconBg: 'bg-red-100',    button: 'bg-red-600 hover:bg-red-700 disabled:bg-red-400' },
  warning: { iconBg: 'bg-yellow-100', button: 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400' },
  info:    { iconBg: 'bg-blue-100',   button: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400' },
} as const;

const VARIANT_ICONS: Record<string, React.ReactNode> = {
  danger: (
    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  warning: (
    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/** Focusable element selectors for focus-trap cycling. */
const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// ─── Sub-component: dialog body with text and actions ────────────────────────

interface DialogBodyProps {
  readonly titleId: string;
  readonly messageId: string;
  readonly title: string;
  readonly message: string;
  readonly iconBg: string;
  readonly icon: React.ReactNode;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly loading: boolean;
  readonly buttonClass: string;
  readonly cancelBtnRef: RefObject<HTMLButtonElement | null>;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

const DialogBody = ({
  titleId, messageId, title, message, iconBg, icon,
  cancelLabel, confirmLabel, loading, buttonClass, cancelBtnRef,
  onCancel, onConfirm,
}: DialogBodyProps) => (
  <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
    <div className="flex items-start gap-4 mb-4">
      <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
        {icon}
      </span>
      <div>
        <h3 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h3>
        <p id={messageId} className="text-sm text-gray-600 mt-1">{message}</p>
      </div>
    </div>
    <div className="flex gap-3 justify-end">
      <button
        ref={cancelBtnRef}
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={loading}
        className={`px-4 py-2 text-sm font-medium text-white rounded-md transition disabled:cursor-not-allowed flex items-center gap-2 ${buttonClass}`}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {confirmLabel}
      </button>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

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
  // Unique IDs per instance — safe when multiple dialogs are in the DOM simultaneously.
  const uid = useId();
  const titleId = `${uid}-title`;
  const messageId = `${uid}-message`;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog when it opens and trap Tab / Shift+Tab inside.
  useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(() => { cancelBtnRef.current?.focus(); });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) { onCancel(); return; }
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
      if (focusable.length === 0) return;

      const first = focusable[0];
      // Safe: early return above guarantees focusable.length > 0
      const last = focusable.at(-1)!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <dialog
      ref={dialogRef}
      open
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent border-none m-0 w-full max-w-none"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div className="absolute inset-0 bg-black/50" onClick={loading ? undefined : onCancel} aria-hidden="true" />
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
  );
};

export default ConfirmDialog;
