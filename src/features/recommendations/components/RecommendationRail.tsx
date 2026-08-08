import { RecommendationTracker } from '@/features/recommendations/components/RecommendationTracker'
import type {
  RecommendationItem,
  RecommendationSurface,
} from '@/features/recommendations/validations'

interface RecommendationRailProps {
  readonly title: string
  readonly surface: RecommendationSurface
  readonly anchorProductId?: string | null
  readonly products: readonly RecommendationItem[]
  readonly fallback: boolean
}

/**
 * A recommendation rail.
 *
 * A Server Component: it holds no state and needs no browser API. Everything
 * that does — currency formatting and the impression/click beacons — lives in
 * the `RecommendationTracker` leaf.
 *
 * Renders nothing when there are no products. An empty rail is worse than no
 * rail: it occupies vertical space and tells the shopper the catalog is empty.
 *
 * Deliberately does not reuse `BestsellersScroller`, whose props require
 * `ProductGridItem` — a type carrying numeric `stock` and `soldCount` that
 * recommendation responses must never expose (FR-010). Every item reaching
 * this component is in stock by construction, because the selection service
 * filters out anything without sellable inventory, so no availability badge is
 * rendered; showing one would imply a magnitude the rail does not have.
 */
export function RecommendationRail({
  title,
  surface,
  anchorProductId = null,
  products,
  fallback,
}: RecommendationRailProps) {
  if (products.length === 0) return null

  return (
    <section className="mt-10" aria-labelledby={`recommendations-${surface}`}>
      <h2
        id={`recommendations-${surface}`}
        className="mb-4 text-xl font-semibold text-[var(--foreground)]"
      >
        {title}
      </h2>
      <RecommendationTracker
        surface={surface}
        anchorProductId={anchorProductId}
        products={products}
        fallback={fallback}
      />
    </section>
  )
}
