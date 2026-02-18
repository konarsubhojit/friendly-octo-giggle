/**
 * Shared product card skeleton component
 * Used in product listing pages for consistency
 */
export default function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100">
      {/* Image Skeleton */}
      <div className="relative h-64 w-full bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="p-4 space-y-3">
        {/* Title Skeleton */}
        <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />

        {/* Description Skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Price and Stock Row */}
        <div className="flex justify-between items-center pt-2">
          <div className="h-8 w-24 bg-blue-100 rounded animate-pulse" />
          <div className="h-6 w-24 bg-green-100 rounded-full animate-pulse" />
        </div>

        {/* Category Badge */}
        <div className="h-7 w-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
