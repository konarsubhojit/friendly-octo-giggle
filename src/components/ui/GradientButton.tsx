import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonSize = 'sm' | 'md' | 'lg'
type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode
  readonly size?: ButtonSize
  readonly variant?: ButtonVariant
  /** Show a loading spinner and disable the button. */
  readonly loading?: boolean
  readonly loadingText?: string
  /** Make the button fill its container width. */
  readonly fullWidth?: boolean
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--btn-primary)] to-[var(--btn-primary-hover)] hover:from-[var(--btn-primary-hover)] hover:to-[var(--btn-primary)] text-white shadow-warm hover:shadow-warm-lg',
  secondary:
    'bg-[var(--text-secondary)] bg-gradient-to-r from-[var(--text-secondary)] to-[var(--text-muted)] hover:from-[var(--text-muted)] hover:to-[var(--text-secondary)] text-white shadow-warm hover:shadow-warm-lg',
  danger:
    'bg-red-600 bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white shadow-md hover:shadow-lg',
}

/**
 * Gradient-fill button — the standard call-to-action button used throughout
 * the app.
 *
 * Usage:
 * ```tsx
 * <GradientButton onClick={handleSubmit}>Place Order</GradientButton>
 * <GradientButton size="lg" fullWidth loading={saving}>Saving…</GradientButton>
 * <GradientButton variant="danger" size="sm">Delete</GradientButton>
 * ```
 */
export function GradientButton({
  children,
  size = 'md',
  variant = 'primary',
  loading = false,
  loadingText,
  fullWidth = false,
  disabled,
  className = '',
  type = 'button',
  ...rest
}: Readonly<GradientButtonProps>) {
  const isDisabled = disabled ?? loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={[
        'font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus-warm',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  )
}
