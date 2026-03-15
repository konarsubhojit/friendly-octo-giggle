import type { ReactNode } from 'react';
import Link from 'next/link';

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

const DefaultIcon = () => (
  <svg
    className="w-16 h-16 text-gray-300"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
    />
  </svg>
);

const CTA_BTN =
  'inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg';

interface CtaProps {
  readonly text: string;
  readonly href?: string;
  readonly onClick?: () => void;
}

const CtaElement = ({ text, href, onClick }: CtaProps) => {
  if (href) {
    return <Link href={href} className={CTA_BTN}>{text}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={CTA_BTN}>{text}</button>;
  }
  return null;
};

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
export function EmptyState({
  icon,
  title,
  message,
  ctaText,
  ctaHref,
  onCtaClick,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`py-16 text-center ${className}`}>
      <div className="flex items-center justify-center mb-6">
        {icon ?? <DefaultIcon />}
      </div>
      <h2 className="text-2xl font-bold text-gray-700 mb-2">{title}</h2>
      {message && <p className="text-gray-500 mb-6">{message}</p>}
      {ctaText && <CtaElement text={ctaText} href={ctaHref} onClick={onCtaClick} />}
    </div>
  );
}
