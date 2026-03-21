import type { ReactNode } from 'react';

export type AlertVariant = 'error' | 'success' | 'info';

interface AlertBannerProps {
  readonly message: ReactNode;
  readonly variant?: AlertVariant;
  /** If provided, renders a dismiss ✕ button that calls this handler. */
  readonly onDismiss?: () => void;
  readonly className?: string;
}

const VARIANT_STYLES: Record<AlertVariant, string> = {
  error:   'bg-red-50   border-red-200   text-red-700',
  success: 'bg-green-50 border-green-200 text-green-700',
  info:    'bg-blue-50  border-blue-200  text-blue-700',
};

const ICON_PATHS: Record<AlertVariant, string> = {
  error:
    'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
  success:
    'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
  info:
    'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z',
};

/**
 * Dismissible alert banner for error, success, and informational messages.
 *
 * Usage:
 * ```tsx
 * <AlertBanner message="Something went wrong." variant="error" onDismiss={() => setErr('')} />
 * <AlertBanner message="Saved!" variant="success" />
 * ```
 */
export const AlertBanner = ({
  message,
  variant = 'error',
  onDismiss,
  className = '',
}: AlertBannerProps) => {
  return (
    <div
      className={`p-4 rounded-xl border flex items-start gap-3 ${VARIANT_STYLES[variant]} ${className}`}
      role="alert"
    >
      <svg
        className="w-5 h-5 flex-shrink-0 mt-0.5"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path fillRule="evenodd" d={ICON_PATHS[variant]} clipRule="evenodd" />
      </svg>
      <span className="font-medium flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto -mt-0.5 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss alert"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}
