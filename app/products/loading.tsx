import HeaderSkeleton from '@/components/skeletons/HeaderSkeleton';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';

const PRODUCT_SKELETONS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'] as const;

export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <HeaderSkeleton />

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
            <ProductCardSkeleton key={id} />
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
