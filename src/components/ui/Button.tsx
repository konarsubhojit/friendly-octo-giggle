import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'gradient'
  | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  /** Show a loading state and disable the button. */
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
  /** Warm-primary gradient — the default action button. */
  primary:
    'bg-gradient-to-r from-[var(--btn-primary)] to-[var(--btn-primary-hover)] hover:from-[var(--btn-primary-hover)] hover:to-[var(--btn-primary)] text-white shadow-warm hover:shadow-warm-lg',
  /** Muted secondary gradient. */
  secondary:
    'bg-gradient-to-r from-[var(--text-secondary)] to-[var(--text-muted)] hover:from-[var(--text-muted)] hover:to-[var(--text-secondary)] text-white shadow-warm hover:shadow-warm-lg',
  /** Coral / warm CTA gradient (matches CtaButton). */
  gradient:
    'bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] text-white shadow-warm hover:shadow-warm-lg hover:scale-105',
  /** Soft ghost button — blush background, warm border. */
  ghost:
    'bg-[var(--accent-blush)] text-[var(--text-secondary)] border border-[var(--border-warm)] hover:bg-[var(--accent-cream)]',
  /** Destructive / danger action. */
  danger:
    'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white shadow-md hover:shadow-lg',
}

/**
 * Unified button primitive for the design system.
 *
 * Usage:
 * ```tsx
 * <Button onClick={handleSubmit}>Place Order</Button>
 * <Button variant="gradient" size="lg" fullWidth>Shop Now</Button>
 * <Button variant="ghost" onClick={onCancel}>Cancel</Button>
 * <Button variant="danger" size="sm" loading={deleting}>Delete</Button>
 * ```
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  fullWidth = false,
  disabled,
  className = '',
  type = 'button',
  ...rest
}: Readonly<ButtonProps>) {
  const isDisabled = disabled || loading

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
