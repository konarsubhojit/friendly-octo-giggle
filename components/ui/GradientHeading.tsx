import type { ReactNode } from "react";

type HeadingLevel = "h1" | "h2" | "h3" | "h4";
type HeadingSize = "sm" | "md" | "lg" | "xl";

interface GradientHeadingProps {
  readonly children: ReactNode;
  readonly as?: HeadingLevel;
  readonly size?: HeadingSize;
  /** Extra Tailwind classes applied to the element. */
  readonly className?: string;
}

const SIZE_CLASSES: Record<HeadingSize, string> = {
  sm: "text-xl  font-bold",
  md: "text-2xl font-bold",
  lg: "text-3xl font-bold",
  xl: "text-4xl font-extrabold",
};

const GRADIENT =
  "font-display bg-gradient-to-r from-[var(--accent-rose)] via-[var(--accent-pink)] to-[var(--accent-warm)] bg-clip-text text-transparent";

/**
 * Heading element with the standard blue-to-purple gradient text effect.
 *
 * Usage:
 * ```tsx
 * <GradientHeading>My Account</GradientHeading>
 * <GradientHeading as="h2" size="md" className="mb-4">Section Title</GradientHeading>
 * ```
 */
export function GradientHeading({
  children,
  as: Tag = "h1",
  size = "lg",
  className = "",
}: GradientHeadingProps) {
  return (
    <Tag className={`${SIZE_CLASSES[size]} ${GRADIENT} ${className}`}>
      {children}
    </Tag>
  );
}
