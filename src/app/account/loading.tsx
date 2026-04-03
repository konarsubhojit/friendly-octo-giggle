export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title skeleton */}
        <div className="h-10 w-48 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-lg animate-pulse mb-8" />

        {/* Profile section skeleton */}
        <div className="p-6 bg-[var(--surface)] rounded-xl border border-[var(--border-warm)] space-y-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[var(--accent-peach)] rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-40 bg-[var(--accent-blush)] rounded animate-pulse" />
              <div className="h-4 w-56 bg-[var(--accent-blush)] rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Form fields skeleton */}
        <div className="p-6 bg-[var(--surface)] rounded-xl border border-[var(--border-warm)] space-y-6">
          {(['f1', 'f2', 'f3'] as const).map((id) => (
            <div key={id} className="space-y-2">
              <div className="h-4 w-24 bg-[var(--accent-blush)] rounded animate-pulse" />
              <div className="h-10 w-full bg-[var(--accent-peach)]/50 rounded-lg border border-[var(--border-warm)] animate-pulse" />
            </div>
          ))}
          <div className="h-12 w-32 bg-[var(--accent-peach)] rounded-full animate-pulse" />
        </div>
      </main>
    </div>
  )
}
