'use client';

import type { RefObject, ReactNode } from 'react';

export interface DialogBodyProps {
  readonly titleId: string;
  readonly messageId: string;
  readonly title: string;
  readonly message: string;
  readonly iconBg: string;
  readonly icon: ReactNode;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly loading: boolean;
  readonly buttonClass: string;
  readonly cancelBtnRef: RefObject<HTMLButtonElement | null>;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export const DialogBody = ({
  titleId, messageId, title, message, iconBg, icon,
  cancelLabel, confirmLabel, loading, buttonClass, cancelBtnRef,
  onCancel, onConfirm,
}: DialogBodyProps) => {
  return (
    <div className="relative bg-[var(--surface)] rounded-2xl shadow-warm-lg border border-[var(--border-warm)] max-w-sm w-full p-6">
      <div className="flex items-start gap-4 mb-4">
        <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </span>
        <div>
          <h3 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
          <p id={messageId} className="text-sm text-[var(--text-secondary)] mt-1">{message}</p>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button
          ref={cancelBtnRef}
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--accent-blush)] rounded-full hover:bg-[var(--accent-cream)] disabled:opacity-50 disabled:cursor-not-allowed transition border border-[var(--border-warm)]"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-full transition disabled:cursor-not-allowed flex items-center gap-2 ${buttonClass}`}
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
}
