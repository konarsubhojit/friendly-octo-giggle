import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button, type ButtonSize } from '@/components/ui/Button'

type GradientVariant = 'primary' | 'secondary' | 'danger'

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode
  readonly size?: ButtonSize
  readonly variant?: GradientVariant
  /** Show a loading state and disable the button. */
  readonly loading?: boolean
  readonly loadingText?: string
  /** Make the button fill its container width. */
  readonly fullWidth?: boolean
}

/**
 * @deprecated Use `<Button>` directly.
 * Thin wrapper kept for backward compatibility — delegates to Button.
 *
 * Usage:
 * ```tsx
 * <GradientButton onClick={handleSubmit}>Place Order</GradientButton>
 * <GradientButton size="lg" fullWidth loading={saving}>Saving…</GradientButton>
 * <GradientButton variant="danger" size="sm">Delete</GradientButton>
 * ```
 */
export function GradientButton({
  variant = 'primary',
  ...props
}: Readonly<GradientButtonProps>) {
  return <Button variant={variant} {...props} />
}
