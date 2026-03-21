import type { ReactNode } from "react";
import { EmptyStateIcon } from "@/components/ui/EmptyStateIcon";
import { CtaButton } from "@/components/ui/CtaButton";

interface EmptyStateProps {
  /** SVG icon rendered in the empty-state circle. Defaults to a generic empty-box icon. */
  readonly icon?: ReactNode;
  readonly title: string;
  readonly message?: string;
  /** Text for the optional call-to-action link button. */
  readonly ctaText?: string;
  /** href for the optional call-to-action link. Takes precedence over `onCtaClick`. */
  readonly ctaHref?: string;
  /** Click handler for the optional call-to-action button (used when there is no href). */
  readonly onCtaClick?: () => void;
  readonly className?: string;
}

/**
 * Generic empty-state placeholder used when a list or page has no content.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   title="Your cart is empty"
 *   message="Add some products to get started!"
 *   ctaText="Browse Products"
 *   ctaHref="/"
 * />
 * ```
 */
export const EmptyState = ({
  icon,
  title,
  message,
  ctaText,
  ctaHref,
  onCtaClick,
  className = "",
}: EmptyStateProps) => {
  return (
    <div
      className={`py-16 text-center bg-[var(--surface)] rounded-3xl border border-[var(--border-warm)] ${className}`}
    >
      <div className="flex items-center justify-center mb-6">
        {icon ?? <EmptyStateIcon />}
      </div>
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
        {title}
      </h2>
      {message && (
        <p className="text-[var(--text-secondary)] mb-6">{message}</p>
      )}
      {ctaText && (
        <CtaButton text={ctaText} href={ctaHref} onClick={onCtaClick} />
      )}
    </div>
  );
}
