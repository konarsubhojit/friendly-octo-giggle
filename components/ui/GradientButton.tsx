import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
  /** Show a loading spinner and disable the button. */
  readonly loading?: boolean;
  readonly loadingText?: string;
  /** Make the button fill its container width. */
  readonly fullWidth?: boolean;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg',
  secondary:
    'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-md hover:shadow-lg',
  danger:
    'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md hover:shadow-lg',
};

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
  const isDisabled = disabled ?? loading;

  return (
    <button
      // eslint-disable-next-line react/button-has-type
      type={type}
      disabled={isDisabled}
      className={[
        'font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed',
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
  );
}
