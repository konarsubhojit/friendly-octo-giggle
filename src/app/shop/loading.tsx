import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton'

const SKELETON_IDS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const

export default function ShopLoading() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      {/* Page header skeleton */}
      <section className="pt-8 pb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="h-12 w-32 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-xl animate-pulse mb-3" />
        <div className="h-5 w-72 bg-[var(--accent-blush)] rounded animate-pulse" />
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Section header skeleton */}
        <div className="h-9 w-48 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-64 bg-[var(--accent-blush)] rounded animate-pulse mb-8" />

        {/* Search + filter skeleton */}
        <div className="mb-8 space-y-4">
          <div className="h-12 w-72 bg-[var(--surface)] rounded-full border border-[var(--border-warm)] animate-pulse" />
          <div className="flex gap-2 flex-wrap">
            {['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => (
              <div
                key={id}
                className="h-8 w-20 bg-[var(--surface)] rounded-full border border-[var(--border-warm)] animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SKELETON_IDS.map((id) => (
            <ProductCardSkeleton key={id} />
          ))}
        </div>
      </main>
    </div>
  )
}
