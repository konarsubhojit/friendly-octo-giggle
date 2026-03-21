import type { ReactNode } from "react";

export type BadgeVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "primary"
  | "sage"
  | "peach"
  | "blush";

interface BadgeProps {
  readonly children: ReactNode;
  readonly variant?: BadgeVariant;
  readonly size?: "sm" | "md";
  readonly className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-[var(--accent-sage)]/20 text-[var(--accent-sage)]",
  warning: "bg-[var(--accent-peach)]/30 text-[var(--accent-rose)]",
  error: "bg-[var(--accent-warm)]/20 text-[var(--accent-rose)]",
  info: "bg-[var(--accent-blush)] text-[var(--accent-rose)]",
  neutral: "bg-[var(--border-warm)]/30 text-[var(--text-secondary)]",
  primary: "bg-[var(--accent-blush)] text-[var(--accent-rose)]",
  sage: "bg-[var(--accent-sage)]/20 text-[var(--accent-sage)]",
  peach: "bg-[var(--accent-peach)]/30 text-[var(--accent-rose)]",
  blush: "bg-[var(--accent-blush)] text-[var(--accent-rose)]",
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1   text-sm",
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
  variant = "neutral",
  size = "md",
  className = "",
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
    PENDING: "warning",
    PROCESSING: "info",
    SHIPPED: "primary",
    DELIVERED: "success",
    CANCELLED: "error",
  };
  return map[status.toUpperCase()] ?? "neutral";
}

/** Maps a user-role string to the appropriate `BadgeVariant`. */
export function roleVariant(role: string): BadgeVariant {
  return role.toUpperCase() === "ADMIN" ? "primary" : "success";
}
