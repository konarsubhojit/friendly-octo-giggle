/**
 * Shared product card skeleton component
 * Used in product listing pages for consistency
 */
export default function ProductCardSkeleton() {
  return (
    <div className="bg-[var(--accent-cream)]/80 rounded-2xl shadow-warm overflow-hidden border-2 border-[var(--border-warm)]">
      {/* Image Skeleton */}
      <div className="relative h-64 w-full bg-gradient-to-br from-[var(--accent-peach)] to-[var(--accent-blush)] animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="p-4 space-y-3">
        {/* Title Skeleton */}
        <div className="h-6 w-3/4 bg-[var(--accent-peach)] rounded animate-pulse" />

        {/* Description Skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-[var(--accent-blush)] rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-[var(--accent-blush)] rounded animate-pulse" />
        </div>

        {/* Price and Stock Row */}
        <div className="flex justify-between items-center pt-2">
          <div className="h-8 w-24 bg-[var(--accent-peach)] rounded animate-pulse" />
          <div className="h-6 w-24 bg-[var(--accent-sage)]/30 rounded-full animate-pulse" />
        </div>

        {/* Category Badge */}
        <div className="h-7 w-24 bg-gradient-to-r from-[var(--accent-peach)] to-[var(--accent-blush)] rounded-full animate-pulse" />
      </div>
    </div>
  );
}
