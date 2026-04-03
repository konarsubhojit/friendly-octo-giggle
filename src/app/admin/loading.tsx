export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title skeleton */}
        <div className="h-10 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-8" />

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {(["s1", "s2", "s3", "s4"] as const).map((id) => (
            <div
              key={id}
              className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-8 w-16 bg-slate-300 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {(["r1", "r2", "r3", "r4", "r5"] as const).map((id) => (
              <div key={id} className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
