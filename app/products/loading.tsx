const PRODUCT_SKELETONS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'] as const;

export default function ProductsLoading() {
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
        {/* Page Title Skeleton */}
        <div className="mb-8">
          <div className="h-10 w-64 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg animate-pulse mb-4" />
          <div className="h-5 w-96 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Filter/Sort Bar Skeleton */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="h-10 w-32 bg-white rounded-lg border border-gray-200 animate-pulse" />
          <div className="h-10 w-40 bg-white rounded-lg border border-gray-200 animate-pulse" />
          <div className="h-10 w-28 bg-white rounded-lg border border-gray-200 animate-pulse" />
        </div>

        {/* Product Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRODUCT_SKELETONS.map((id) => (
            <div
              key={id}
              className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100"
            >
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
          ))}
        </div>

        {/* Pagination Skeleton */}
        <div className="flex justify-center items-center gap-2 mt-12">
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-blue-200 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </main>
    </div>
  );
}
