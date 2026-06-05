export default function CartLoading() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title skeleton */}
        <div className="h-10 w-48 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-lg animate-pulse mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart items skeleton */}
          <div className="lg:col-span-2 space-y-4">
            {(['c1', 'c2', 'c3'] as const).map((id) => (
              <div
                key={id}
                className="flex gap-4 p-4 bg-[var(--surface)] rounded-xl border border-[var(--border-warm)]"
              >
                <div className="w-24 h-24 bg-[var(--accent-peach)] rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 bg-[var(--accent-blush)] rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-[var(--accent-blush)] rounded animate-pulse" />
                  <div className="flex items-center gap-3 mt-2">
                    <div className="h-8 w-24 bg-[var(--accent-peach)] rounded-lg animate-pulse" />
                    <div className="h-8 w-16 bg-[var(--accent-blush)] rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary skeleton */}
          <div className="p-6 bg-[var(--surface)] rounded-xl border border-[var(--border-warm)] h-fit space-y-4">
            <div className="h-6 w-32 bg-[var(--accent-peach)] rounded animate-pulse" />
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-[var(--accent-blush)] rounded animate-pulse" />
                <div className="h-4 w-16 bg-[var(--accent-blush)] rounded animate-pulse" />
              </div>
              <div className="border-t border-[var(--border-warm)] pt-3 flex justify-between">
                <div className="h-5 w-16 bg-[var(--accent-peach)] rounded animate-pulse" />
                <div className="h-5 w-20 bg-[var(--accent-peach)] rounded animate-pulse" />
              </div>
            </div>
            <div className="h-12 w-full bg-[var(--accent-peach)] rounded-full animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  )
}
