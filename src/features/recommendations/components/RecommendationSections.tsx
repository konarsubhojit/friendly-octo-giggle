import { connection } from 'next/server'
import { RecommendationRail } from '@/features/recommendations/components/RecommendationRail'
import {
  getCartRail,
  getProductRail,
  getZeroResultRail,
} from '@/features/recommendations/services/selection'

/**
 * Every rail resolves through Redis, which is request-scoped state a
 * `"use cache"` scope may not hold and a prerender may not evaluate. Without
 * this marker Next.js attempts to prerender the rail along with the product
 * shell and fails on the clock read inside the cache client.
 *
 * Calling it here rather than in each page keeps the rule with the code that
 * depends on it: a new surface gets the behaviour by construction.
 */
const markPerRequest = () => connection()

/**
 * Related products for a product detail page.
 *
 * An async Server Component so the caller can drop it inside its own
 * `Suspense` boundary and let the rail stream in after the page has painted.
 * The rail is never awaited in the page body, so it can neither block the
 * first paint nor become the LCP element.
 */
export async function ProductRecommendations({
  anchorProductId,
  category,
}: {
  readonly anchorProductId: string
  readonly category?: string | null
}) {
  await markPerRequest()
  const result = await getProductRail(anchorProductId, { category })

  return (
    <RecommendationRail
      title="You might also like"
      surface="product"
      anchorProductId={anchorProductId}
      products={result.products}
      fallback={result.fallback}
    />
  )
}

/**
 * Cross-sell derived from the whole basket.
 *
 * Renders nothing for an empty cart: the selection service returns an empty
 * result rather than bestsellers, because there is nothing to cross-sell
 * against.
 */
export async function CartRecommendations({
  cartProductIds,
}: {
  readonly cartProductIds: readonly string[]
}) {
  await markPerRequest()
  const result = await getCartRail(cartProductIds)

  return (
    <RecommendationRail
      title="Goes well with your cart"
      surface="cart"
      products={result.products}
      fallback={result.fallback}
    />
  )
}

/**
 * Recovery for a search that matched nothing.
 *
 * Passes the active category through so the suggestions stay inside the
 * shopper's stated filter rather than overriding it.
 */
export async function ZeroResultRecommendations({
  category,
}: {
  readonly category?: string | null
}) {
  await markPerRequest()
  const result = await getZeroResultRail({ category })

  return (
    <RecommendationRail
      title="You may like these instead"
      surface="zero_result"
      products={result.products}
      fallback={result.fallback}
    />
  )
}
