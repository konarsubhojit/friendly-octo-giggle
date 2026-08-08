import BestsellerCardSkeleton from '@/components/skeletons/BestsellerCardSkeleton'

const PLACEHOLDER_COUNT = 4

/**
 * Placeholder for a streaming recommendation rail.
 *
 * Reuses the bestseller tile geometry so the skeleton occupies exactly the
 * height the resolved rail will, which is what keeps the swap from shifting
 * everything below it once the rail streams in.
 */
export default function RecommendationRailSkeleton({
  title = 'You might also like',
}: {
  readonly title?: string
}) {
  return (
    <section aria-busy="true" aria-label={`${title} loading`} className="mt-10">
      <div className="mb-4 h-7 w-56 rounded bg-[var(--accent-blush)] animate-pulse" />
      <div className="flex items-stretch gap-4 overflow-hidden pb-3">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <BestsellerCardSkeleton key={`recommendation-placeholder-${index}`} />
        ))}
      </div>
    </section>
  )
}
