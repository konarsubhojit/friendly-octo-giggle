import type { ReactNode } from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'primary';

interface BadgeProps {
  readonly children: ReactNode;
  readonly variant?: BadgeVariant;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-green-100  text-green-700',
  warning: 'bg-amber-100  text-amber-700',
  error:   'bg-red-100    text-red-700',
  info:    'bg-blue-100   text-blue-700',
  neutral: 'bg-gray-100   text-gray-600',
  primary: 'bg-purple-100 text-purple-700',
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1   text-sm',
};

/**
 * Small status / label chip used throughout the app for stock levels, order
 * statuses, user roles, categories, and other state indicators.
 *
 * Usage:
 * ```tsx
 * <Badge variant="success">In Stock</Badge>
 * <Badge variant="warning" size="sm">Only 3 left</Badge>
 * <Badge variant="error">Out of Stock</Badge>
 * <Badge variant="primary">ADMIN</Badge>
 * ```
 */
export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {children}
    </span>
  );
}

// ─── Convenience helpers for common domain patterns ───────────────────────────

/** Maps an order-status string to the appropriate `BadgeVariant`. */
export function orderStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    PENDING:    'warning',
    PROCESSING: 'info',
    SHIPPED:    'primary',
    DELIVERED:  'success',
    CANCELLED:  'error',
  };
  return map[status.toUpperCase()] ?? 'neutral';
}

/** Maps a user-role string to the appropriate `BadgeVariant`. */
export function roleVariant(role: string): BadgeVariant {
  return role.toUpperCase() === 'ADMIN' ? 'primary' : 'neutral';
}
