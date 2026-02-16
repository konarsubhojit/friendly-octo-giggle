const VARIATION_SKELETONS = ['v1', 'v2', 'v3', 'v4'] as const;

export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header Skeleton */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Breadcrumb Skeleton */}
        <nav className="mb-6 flex items-center gap-2">
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-2 bg-gray-300 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image Skeleton */}
          <div className="relative">
            <div className="relative h-96 md:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse">
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              
              {/* Centered loading spinner */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            </div>
            
            {/* Decorative blurs (matching original design) */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-30 -z-10" />
            <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-3xl opacity-30 -z-10" />
          </div>

          {/* Product Details Skeleton */}
          <div className="flex flex-col">
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8 mb-6">
              {/* Title Skeleton */}
              <div className="h-10 w-3/4 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 rounded-lg animate-pulse mb-4" />

              {/* Category Badge Skeleton */}
              <div className="mb-6">
                <div className="h-8 w-28 bg-gradient-to-r from-blue-200 to-purple-200 rounded-full animate-pulse" />
              </div>

              {/* Description Skeleton */}
              <div className="space-y-3 mb-8">
                <div className="h-5 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
              </div>

              {/* Price Skeleton */}
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                <div className="h-12 w-40 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg animate-pulse" />
              </div>

              {/* Stock Badge Skeleton */}
              <div className="mb-6">
                <div className="h-8 w-36 bg-green-100 rounded-full animate-pulse" />
              </div>

              {/* Variations Section Skeleton */}
              <div className="mb-6">
                <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-3" />
                <div className="flex flex-wrap gap-3">
                  {VARIATION_SKELETONS.map((id) => (
                    <div
                      key={id}
                      className="h-10 w-20 bg-gray-200 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              </div>

              {/* Quantity Selector Skeleton */}
              <div className="mb-6">
                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse mb-3" />
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-12 w-16 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse" />
                </div>
              </div>

              {/* Add to Cart Button Skeleton */}
              <div className="h-14 w-full bg-gradient-to-r from-blue-200 to-purple-200 rounded-xl animate-pulse" />
            </div>

            {/* Additional Info Card Skeleton */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6">
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-blue-100 rounded-full animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-green-100 rounded-full animate-pulse" />
                  <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-purple-100 rounded-full animate-pulse" />
                  <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
