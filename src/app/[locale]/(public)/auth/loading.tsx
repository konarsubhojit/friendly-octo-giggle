export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-warm-gradient flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border-warm)] bg-[var(--surface)] p-8 shadow-warm">
        {/* Heading skeleton */}
        <div className="mx-auto mb-8 h-8 w-48 animate-pulse rounded-lg bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)]" />

        {/* Form field skeletons */}
        <div className="space-y-5">
          {(['f1', 'f2'] as const).map((id) => (
            <div key={id} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--accent-blush)]" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-[var(--accent-peach)]" />
            </div>
          ))}

          {/* Submit button skeleton */}
          <div className="h-11 w-full animate-pulse rounded-xl bg-[var(--accent-rose)]" />
        </div>

        {/* Divider + secondary action skeleton */}
        <div className="mt-8 h-4 w-40 mx-auto animate-pulse rounded bg-[var(--accent-blush)]" />
      </div>
    </div>
  )
}
