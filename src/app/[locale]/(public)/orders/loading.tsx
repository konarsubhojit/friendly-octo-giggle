export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title skeleton */}
        <div className="h-10 w-40 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-lg animate-pulse mb-8" />

        {/* Search bar skeleton */}
        <div className="h-12 w-full max-w-md bg-[var(--surface)] rounded-full border border-[var(--border-warm)] animate-pulse mb-8" />

        {/* Order cards skeleton */}
        <div className="space-y-4">
          {(['o1', 'o2', 'o3'] as const).map((id) => (
            <div
              key={id}
              className="p-6 bg-[var(--surface)] rounded-xl border border-[var(--border-warm)] space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-32 bg-[var(--accent-peach)] rounded animate-pulse" />
                <div className="h-6 w-24 bg-[var(--accent-blush)] rounded-full animate-pulse" />
              </div>
              <div className="h-4 w-48 bg-[var(--accent-blush)] rounded animate-pulse" />
              <div className="flex gap-3">
                <div className="w-14 h-14 bg-[var(--accent-peach)] rounded-lg animate-pulse" />
                <div className="w-14 h-14 bg-[var(--accent-peach)] rounded-lg animate-pulse" />
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--border-warm)]">
                <div className="h-4 w-24 bg-[var(--accent-blush)] rounded animate-pulse" />
                <div className="h-5 w-20 bg-[var(--accent-peach)] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
