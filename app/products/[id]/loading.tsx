const VARIATION_SKELETONS = ["v1", "v2", "v3", "v4"] as const;

const ImageSkeleton = () => {
  return (
    <div className="relative">
      <div className="relative h-96 md:h-[600px] w-full rounded-2xl overflow-hidden shadow-warm-lg border-2 border-[var(--border-warm)] bg-gradient-to-br from-[var(--accent-peach)] to-[var(--accent-blush)] animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-[var(--accent-peach)] border-t-[var(--accent-warm)] rounded-full animate-spin" />
        </div>
      </div>
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-[var(--accent-peach)] to-[var(--accent-blush)] rounded-full blur-3xl opacity-30 -z-10" />
      <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-gradient-to-r from-[var(--accent-sage)] to-[var(--accent-cream)] rounded-full blur-3xl opacity-30 -z-10" />
    </div>
  );
}

const DetailsSkeleton = () => {
  return (
    <div className="flex flex-col">
      <div className="bg-[var(--surface)]/80 backdrop-blur-lg rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 mb-6">
        <div className="h-10 w-3/4 bg-gradient-to-r from-[var(--accent-warm)] via-[var(--accent-rose)] to-[var(--accent-warm)] rounded-lg animate-pulse mb-4" />
        <div className="mb-6">
          <div className="h-8 w-28 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-full animate-pulse" />
        </div>
        <div className="space-y-3 mb-8">
          <div className="h-5 w-full bg-[var(--accent-blush)] rounded animate-pulse" />
          <div className="h-5 w-full bg-[var(--accent-blush)] rounded animate-pulse" />
          <div className="h-5 w-3/4 bg-[var(--accent-blush)] rounded animate-pulse" />
        </div>
        <div className="mb-6 p-4 bg-gradient-to-r from-[var(--accent-blush)] to-[var(--border-warm)] rounded-xl border border-[var(--border-warm)]">
          <div className="h-12 w-40 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-lg animate-pulse" />
        </div>
        <div className="mb-6">
          <div className="h-8 w-36 bg-[var(--accent-sage)]/20 rounded-full animate-pulse" />
        </div>
        <div className="mb-6">
          <div className="h-6 w-24 bg-[var(--accent-blush)] rounded animate-pulse mb-3" />
          <div className="flex flex-wrap gap-3">
            {VARIATION_SKELETONS.map((id) => (
              <div
                key={id}
                className="h-10 w-20 bg-[var(--accent-blush)] rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="mb-6">
          <div className="h-6 w-20 bg-[var(--accent-blush)] rounded animate-pulse mb-3" />
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-[var(--accent-blush)] rounded-lg animate-pulse" />
            <div className="h-12 w-16 bg-[var(--accent-blush)] rounded-lg animate-pulse" />
            <div className="h-12 w-12 bg-[var(--accent-blush)] rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="h-14 w-full bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-xl animate-pulse" />
      </div>
      <div className="bg-[var(--surface)]/80 backdrop-blur-lg rounded-2xl shadow-warm border border-[var(--border-warm)] p-6">
        <div className="h-6 w-40 bg-[var(--accent-blush)] rounded animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-[var(--accent-blush)] rounded-full animate-pulse" />
            <div className="h-4 w-32 bg-[var(--accent-blush)] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-[var(--accent-sage)]/20 rounded-full animate-pulse" />
            <div className="h-4 w-40 bg-[var(--accent-blush)] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-[var(--accent-blush)] rounded-full animate-pulse" />
            <div className="h-4 w-36 bg-[var(--accent-blush)] rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

const ProductDetailLoading = () => {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {/* Breadcrumb Skeleton */}
        <nav className="mb-6 flex items-center gap-2">
          <div className="h-4 w-12 bg-[var(--accent-blush)] rounded animate-pulse" />
          <div className="h-4 w-2 bg-[var(--accent-peach)] rounded animate-pulse" />
          <div className="h-4 w-32 bg-[var(--accent-blush)] rounded animate-pulse" />
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <ImageSkeleton />
          <DetailsSkeleton />
        </div>
      </main>
    </div>
  );
}
export default ProductDetailLoading;
