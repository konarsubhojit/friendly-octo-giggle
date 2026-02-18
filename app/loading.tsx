import HeaderSkeleton from '@/components/skeletons/HeaderSkeleton';
import HeroSkeleton from '@/components/skeletons/HeroSkeleton';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';

const PRODUCT_SKELETONS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;
const LINK_SKELETONS = ['l1', 'l2', 'l3', 'l4'] as const;

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <HeaderSkeleton />

      <HeroSkeleton />

      {/* Product Grid Skeleton */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="h-9 w-56 bg-gray-200 rounded-lg animate-pulse mb-8" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRODUCT_SKELETONS.map((id) => (
            <ProductCardSkeleton key={id} />
          ))}
        </div>
      </main>

      {/* Footer Skeleton */}
      <footer className="bg-gray-100 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
            </div>
            <div>
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-2">
                {LINK_SKELETONS.map((id) => (
                  <div key={id} className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </div>
            <div>
              <div className="h-6 w-28 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
