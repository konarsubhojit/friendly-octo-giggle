/**
 * Cottage-core decorative SVG elements used throughout the site.
 * Flowers, leaves, sparkles, vine dividers — all inline SVG for zero-latency rendering.
 */

/** Small 5-petal flower — use as accent next to headings or between nav items */
export const FlowerAccent = ({
  className = "w-5 h-5",
}: {
  readonly className?: string;
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" fill="var(--accent-warm, #e8a87c)" />
      <ellipse
        cx="12"
        cy="5"
        rx="3"
        ry="4"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.8"
      />
      <ellipse
        cx="12"
        cy="19"
        rx="3"
        ry="4"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.8"
      />
      <ellipse
        cx="5"
        cy="12"
        rx="4"
        ry="3"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.8"
      />
      <ellipse
        cx="19"
        cy="12"
        rx="4"
        ry="3"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.8"
      />
      <ellipse
        cx="7"
        cy="7"
        rx="3"
        ry="3.5"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.6"
        transform="rotate(-45 7 7)"
      />
      <ellipse
        cx="17"
        cy="17"
        rx="3"
        ry="3.5"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.6"
        transform="rotate(-45 17 17)"
      />
      <ellipse
        cx="17"
        cy="7"
        rx="3"
        ry="3.5"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.6"
        transform="rotate(45 17 7)"
      />
      <ellipse
        cx="7"
        cy="17"
        rx="3"
        ry="3.5"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.6"
        transform="rotate(45 7 17)"
      />
    </svg>
  );
};

/** Small decorative leaf — pairs well with text elements */
export const LeafAccent = ({
  className = "w-4 h-4",
}: {
  readonly className?: string;
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M17 8C17 8 13 4 7 4C7 4 7 10 7 14C7 18 11 20 11 20"
        stroke="var(--accent-sage, #b8c9a3)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="var(--accent-sage, #b8c9a3)"
        opacity="0.6"
      />
      <path
        d="M7 14C10 11 14 9 17 8"
        stroke="var(--accent-sage, #b8c9a3)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** Tiny sparkle/diamond for subtle emphasis */
export const SparkleAccent = ({
  className = "w-3 h-3",
}: {
  readonly className?: string;
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 0L9.5 6.5L16 8L9.5 9.5L8 16L6.5 9.5L0 8L6.5 6.5L8 0Z"
        fill="var(--accent-warm, #e8a87c)"
        opacity="0.7"
      />
    </svg>
  );
};

/** Decorative vine/scroll divider — use between sections */
export const VineDivider = ({
  className = "",
}: {
  readonly className?: string;
}) => {
  return (
    <div
      className={`flex items-center justify-center gap-3 py-4 ${className}`}
      aria-hidden="true"
    >
      <svg className="w-16 h-4" viewBox="0 0 64 16" fill="none">
        <path
          d="M0 8C8 8 8 2 16 2C24 2 24 14 32 14C40 14 40 2 48 2C56 2 56 8 64 8"
          stroke="var(--accent-warm, #e8a87c)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
        <circle
          cx="16"
          cy="2"
          r="2"
          fill="var(--accent-peach, #f8c8a8)"
          opacity="0.6"
        />
        <circle
          cx="48"
          cy="2"
          r="2"
          fill="var(--accent-peach, #f8c8a8)"
          opacity="0.6"
        />
      </svg>
      <FlowerAccent className="w-5 h-5" />
      <svg className="w-16 h-4" viewBox="0 0 64 16" fill="none">
        <path
          d="M0 8C8 8 8 14 16 14C24 14 24 2 32 2C40 2 40 14 48 14C56 14 56 8 64 8"
          stroke="var(--accent-warm, #e8a87c)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
        <circle
          cx="16"
          cy="14"
          r="2"
          fill="var(--accent-peach, #f8c8a8)"
          opacity="0.6"
        />
        <circle
          cx="48"
          cy="14"
          r="2"
          fill="var(--accent-peach, #f8c8a8)"
          opacity="0.6"
        />
      </svg>
    </div>
  );
};

/** Floating scattered flowers for hero/background decoration */
export const ScatteredFlowers = ({
  className = "",
}: {
  readonly className?: string;
}) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Top-left cluster */}
      <FlowerAccent className="absolute top-8 left-[8%] w-6 h-6 opacity-30 animate-float-gentle" />
      <LeafAccent className="absolute top-16 left-[5%] w-5 h-5 opacity-40 animate-float-slow" />
      <SparkleAccent className="absolute top-24 left-[12%] w-3 h-3 opacity-50" />

      {/* Top-right cluster */}
      <FlowerAccent className="absolute top-12 right-[10%] w-5 h-5 opacity-25 animate-float-slow animation-delay-200" />
      <LeafAccent className="absolute top-6 right-[6%] w-4 h-4 opacity-35 animate-float-gentle animation-delay-300" />
      <SparkleAccent className="absolute top-20 right-[15%] w-2 h-2 opacity-40" />

      {/* Bottom-left */}
      <FlowerAccent className="absolute bottom-16 left-[6%] w-4 h-4 opacity-20 animate-float-gentle animation-delay-400" />
      <LeafAccent className="absolute bottom-8 left-[14%] w-6 h-6 opacity-30 animate-float-slow animation-delay-100" />

      {/* Bottom-right */}
      <FlowerAccent className="absolute bottom-12 right-[8%] w-7 h-7 opacity-20 animate-float-slow animation-delay-500" />
      <SparkleAccent className="absolute bottom-24 right-[12%] w-3 h-3 opacity-35 animate-float-gentle animation-delay-200" />

      {/* Mid-scattered */}
      <LeafAccent className="absolute top-1/3 left-[3%] w-5 h-5 opacity-20 animate-float-gentle animation-delay-300" />
      <SparkleAccent className="absolute top-1/2 right-[4%] w-2 h-2 opacity-30" />
    </div>
  );
};

/** Flower bullet icon — use in lists like About page values */
export const FlowerBullet = ({
  className = "w-5 h-5 flex-shrink-0",
}: {
  readonly className?: string;
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="3" fill="var(--accent-rose, #d4856b)" />
      <circle
        cx="10"
        cy="4"
        r="3"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.7"
      />
      <circle
        cx="10"
        cy="16"
        r="3"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.7"
      />
      <circle
        cx="4"
        cy="10"
        r="3"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.7"
      />
      <circle
        cx="16"
        cy="10"
        r="3"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.7"
      />
    </svg>
  );
};

/** Floral cart icon — decorative shopping bag with flower accent */
export const FloralCartIcon = ({
  className = "w-6 h-6",
}: {
  readonly className?: string;
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 6h15l-1.5 9H7.5L6 6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 6L5.25 3H3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="19" r="1.5" fill="currentColor" />
      <circle cx="18" cy="19" r="1.5" fill="currentColor" />
      {/* Flower accent on cart */}
      <circle cx="13" cy="10" r="1.2" fill="var(--accent-warm, #e8a87c)" />
      <circle
        cx="13"
        cy="7.5"
        r="1"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.8"
      />
      <circle
        cx="13"
        cy="12.5"
        r="1"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.8"
      />
      <circle
        cx="10.5"
        cy="10"
        r="1"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.8"
      />
      <circle
        cx="15.5"
        cy="10"
        r="1"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.8"
      />
    </svg>
  );
};

/** Butterfly accent — whimsical decorative element for product/detail pages */
export const ButterflyAccent = ({
  className = "w-8 h-8",
}: {
  readonly className?: string;
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      {/* Left wing */}
      <ellipse
        cx="10"
        cy="12"
        rx="8"
        ry="10"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.6"
        transform="rotate(-15 10 12)"
      />
      <ellipse
        cx="10"
        cy="12"
        rx="5"
        ry="7"
        fill="var(--accent-warm, #e8a87c)"
        opacity="0.4"
        transform="rotate(-15 10 12)"
      />
      {/* Right wing */}
      <ellipse
        cx="22"
        cy="12"
        rx="8"
        ry="10"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.6"
        transform="rotate(15 22 12)"
      />
      <ellipse
        cx="22"
        cy="12"
        rx="5"
        ry="7"
        fill="var(--accent-warm, #e8a87c)"
        opacity="0.4"
        transform="rotate(15 22 12)"
      />
      {/* Body */}
      <ellipse
        cx="16"
        cy="16"
        rx="1.5"
        ry="8"
        fill="var(--accent-rose, #d4856b)"
        opacity="0.7"
      />
      {/* Antennae */}
      <path
        d="M15 8C13 4 11 3 10 3"
        stroke="var(--accent-rose, #d4856b)"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M17 8C19 4 21 3 22 3"
        stroke="var(--accent-rose, #d4856b)"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle
        cx="10"
        cy="3"
        r="1"
        fill="var(--accent-warm, #e8a87c)"
        opacity="0.6"
      />
      <circle
        cx="22"
        cy="3"
        r="1"
        fill="var(--accent-warm, #e8a87c)"
        opacity="0.6"
      />
    </svg>
  );
};

/** Mushroom accent — cottagecore decorative element for about/cart pages */
export const MushroomAccent = ({
  className = "w-8 h-8",
}: {
  readonly className?: string;
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      {/* Cap */}
      <ellipse
        cx="16"
        cy="14"
        rx="12"
        ry="10"
        fill="var(--accent-peach, #f8c8a8)"
        opacity="0.7"
      />
      <ellipse
        cx="16"
        cy="14"
        rx="12"
        ry="10"
        fill="none"
        stroke="var(--accent-warm, #e8a87c)"
        strokeWidth="0.8"
        opacity="0.5"
      />
      {/* Spots */}
      <circle
        cx="11"
        cy="10"
        r="2.5"
        fill="var(--accent-blush, #fde8d8)"
        opacity="0.8"
      />
      <circle
        cx="20"
        cy="8"
        r="2"
        fill="var(--accent-blush, #fde8d8)"
        opacity="0.8"
      />
      <circle
        cx="16"
        cy="13"
        r="1.5"
        fill="var(--accent-blush, #fde8d8)"
        opacity="0.6"
      />
      {/* Stem */}
      <rect
        x="13"
        y="20"
        width="6"
        height="8"
        rx="3"
        fill="var(--accent-cream, #fff5eb)"
        stroke="var(--border-warm, #f0d5c0)"
        strokeWidth="0.8"
      />
      {/* Ground */}
      <ellipse
        cx="16"
        cy="28"
        rx="8"
        ry="1.5"
        fill="var(--accent-sage, #b8c9a3)"
        opacity="0.3"
      />
    </svg>
  );
};

/** Floral border — section divider with simplified variant below 640px */
export const FloralBorder = ({
  className = "",
}: {
  readonly className?: string;
}) => {
  return (
    <div
      className={`flex items-center justify-center py-6 ${className}`}
      aria-hidden="true"
    >
      {/* Full version — hidden on mobile */}
      <div className="hidden sm:flex items-center gap-2">
        <svg className="w-20 h-6" viewBox="0 0 80 24" fill="none">
          <path
            d="M0 12C10 12 10 4 20 4C30 4 30 20 40 20C50 20 50 4 60 4C70 4 70 12 80 12"
            stroke="var(--accent-warm, #e8a87c)"
            strokeWidth="1.2"
            opacity="0.4"
          />
          <circle
            cx="20"
            cy="4"
            r="2.5"
            fill="var(--accent-peach, #f8c8a8)"
            opacity="0.5"
          />
          <circle
            cx="60"
            cy="4"
            r="2.5"
            fill="var(--accent-peach, #f8c8a8)"
            opacity="0.5"
          />
        </svg>
        <FlowerAccent className="w-6 h-6" />
        <LeafAccent className="w-5 h-5 -scale-x-100" />
        <FlowerBullet className="w-4 h-4" />
        <LeafAccent className="w-5 h-5" />
        <FlowerAccent className="w-6 h-6" />
        <svg className="w-20 h-6" viewBox="0 0 80 24" fill="none">
          <path
            d="M0 12C10 12 10 20 20 20C30 20 30 4 40 4C50 4 50 20 60 20C70 20 70 12 80 12"
            stroke="var(--accent-warm, #e8a87c)"
            strokeWidth="1.2"
            opacity="0.4"
          />
          <circle
            cx="20"
            cy="20"
            r="2.5"
            fill="var(--accent-peach, #f8c8a8)"
            opacity="0.5"
          />
          <circle
            cx="60"
            cy="20"
            r="2.5"
            fill="var(--accent-peach, #f8c8a8)"
            opacity="0.5"
          />
        </svg>
      </div>
      {/* Simplified version — shown only on mobile */}
      <div className="flex sm:hidden items-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-peach)] to-transparent opacity-50" />
        <FlowerBullet className="w-4 h-4" />
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-peach)] to-transparent opacity-50" />
      </div>
    </div>
  );
};
