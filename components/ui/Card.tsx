import type { ReactNode } from 'react';

interface CardProps {
  readonly children: ReactNode;
  /** Extra Tailwind classes applied to the card wrapper. */
  readonly className?: string;
}

/**
 * Glass-morphism card — the standard section/panel container used throughout
 * the app (white semi-transparent background, backdrop blur, rounded corners,
 * shadow, and subtle border).
 *
 * Usage:
 * ```tsx
 * <Card>
 *   <h2>Section title</h2>
 *   <p>Content</p>
 * </Card>
 *
 * <Card className="p-4 mb-6">…</Card>
 * ```
 */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 ${className}`}
    >
      {children}
    </div>
  );
}
