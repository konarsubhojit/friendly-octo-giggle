import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { db } from '@/lib/db-queries'
import { productAffinityScores, products, productVariants } from '@/lib/schema'
import { getCachedData } from '@/lib/redis'
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cache'
import { logError } from '@/lib/logger'
import type { Product } from '@/lib/types'
import {
  MAX_PAIRS_PER_ANCHOR,
  RAIL_SIZE,
} from '@/features/recommendations/constants'
import type {
  RecommendationItem,
  RecommendationResult,
  RecommendationSurface,
} from '@/features/recommendations/validations'

/**
 * A candidate as loaded from the database, before projection.
 *
 * `sellableStock` exists only so {@link isEligibleCandidate} can decide; it is
 * dropped by {@link toRecommendationItem} and never leaves this module.
 */
interface CandidateRow {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly image: string
  readonly category: string
  readonly price: number
  readonly sellableStock: number
}

interface EligibilityContext {
  /** Product the rail is anchored on, if any. Never recommends itself. */
  readonly anchorProductId?: string | null
  /** Products the shopper already has (cart contents, prior results). */
  readonly excludeProductIds?: ReadonlySet<string>
}

/**
 * The single eligibility predicate every surface shares.
 *
 * Centralised deliberately: four surfaces each re-deriving "is this candidate
 * showable" is how one of them eventually forgets the soft-delete check.
 */
export const isEligibleCandidate = (
  candidate: CandidateRow,
  context: EligibilityContext
): boolean => {
  if (candidate.sellableStock <= 0) return false
  if (context.anchorProductId && candidate.id === context.anchorProductId) {
    return false
  }
  return !context.excludeProductIds?.has(candidate.id)
}

/**
 * Collapse a candidate to the shape that crosses the service boundary.
 *
 * `sellableStock` becomes a boolean and the magnitude is discarded here, which
 * is what keeps exact inventory out of every response (FR-010). Sales volume
 * is never loaded in the first place.
 */
export const toRecommendationItem = (
  candidate: CandidateRow
): RecommendationItem => ({
  id: candidate.id,
  name: candidate.name,
  description: candidate.description,
  image: candidate.image,
  category: candidate.category,
  price: candidate.price,
  inStock: candidate.sellableStock > 0,
})

/**
 * Project a full `Product` onto the same narrow shape.
 *
 * The bestseller fallback returns `Product`, which carries `soldCount` and
 * per-variant stock. Routing it through the same projection is what stops the
 * fallback branch from leaking fields the scored branch strips — that branch
 * is the one exercised whenever Redis is down, so it is the easier one to get
 * wrong.
 */
const productToRecommendationItem = (product: Product): RecommendationItem => {
  const variants = product.variants ?? []
  const sellableStock = variants.reduce(
    (sum, variant) => sum + (variant.stock - (variant.reservedStock ?? 0)),
    0
  )
  const price =
    variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    image: product.image,
    category: product.category,
    price,
    inStock: sellableStock > 0,
  }
}

/**
 * Load showable candidates for a set of product ids.
 *
 * Reads `reservedStock` alongside `stock` because a unit held by a live
 * checkout is not on sale; `db.products.findMinimalByIds` deliberately reports
 * on-hand stock for cached catalog scopes, which is the wrong basis here.
 */
const loadCandidates = async (
  productIds: readonly string[]
): Promise<Map<string, CandidateRow>> => {
  if (productIds.length === 0) return new Map()

  const rows = await drizzleDb
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      image: products.image,
      category: products.category,
      price: productVariants.price,
      stock: productVariants.stock,
      reservedStock: productVariants.reservedStock,
    })
    .from(products)
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.productId, products.id),
        isNull(productVariants.deletedAt)
      )
    )
    .where(
      and(inArray(products.id, [...productIds]), isNull(products.deletedAt))
    )

  const byId = new Map<string, CandidateRow>()
  for (const row of rows) {
    const sellable =
      row.stock == null ? 0 : Math.max(0, row.stock - (row.reservedStock ?? 0))
    const existing = byId.get(row.id)

    if (!existing) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description,
        image: row.image,
        category: row.category,
        price: row.price ?? 0,
        sellableStock: sellable,
      })
      continue
    }

    byId.set(row.id, {
      ...existing,
      // Lowest active variant price, matching the catalog's "from" price.
      price:
        row.price != null &&
        (existing.price === 0 || row.price < existing.price)
          ? row.price
          : existing.price,
      sellableStock: existing.sellableStock + sellable,
    })
  }

  return byId
}

/** Stable cache key fragment for a multi-anchor read. */
const hashAnchors = (anchorIds: readonly string[]): string =>
  createHash('sha256')
    .update([...anchorIds].sort((a, b) => a.localeCompare(b)).join(','))
    .digest('hex')
    .slice(0, 16)

interface ScoredCandidate {
  readonly recommendedProductId: string
  readonly score: number
}

/** Read scored candidate ids for one or more anchors, ordered strongest first. */
const fetchScoredCandidates = async (
  anchorIds: readonly string[]
): Promise<ScoredCandidate[]> => {
  if (anchorIds.length === 0) return []

  const rows = await drizzleDb
    .select({
      recommendedProductId: productAffinityScores.recommendedProductId,
      score: productAffinityScores.score,
    })
    .from(productAffinityScores)
    .where(inArray(productAffinityScores.anchorProductId, [...anchorIds]))
    .orderBy(desc(productAffinityScores.score))
    .limit(MAX_PAIRS_PER_ANCHOR * anchorIds.length)

  // A product scored against several anchors appears once, at its strongest.
  const best = new Map<string, number>()
  for (const row of rows) {
    const current = best.get(row.recommendedProductId)
    if (current == null || row.score > current) {
      best.set(row.recommendedProductId, row.score)
    }
  }

  return [...best.entries()]
    .map(([recommendedProductId, score]) => ({ recommendedProductId, score }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.recommendedProductId.localeCompare(b.recommendedProductId)
    )
}

/**
 * Read scored candidates through Redis, treating any failure as "no scores".
 *
 * Swallowing the error rather than propagating it is what makes the bestseller
 * fallback fire when Redis is unavailable, so a cache outage degrades the rail
 * instead of breaking the page.
 */
const readScoresCached = async (
  anchorIds: readonly string[]
): Promise<ScoredCandidate[]> => {
  if (anchorIds.length === 0) return []

  const key =
    anchorIds.length === 1
      ? CACHE_KEYS.RECOMMENDATIONS_BY_ANCHOR(anchorIds[0], MAX_PAIRS_PER_ANCHOR)
      : CACHE_KEYS.RECOMMENDATIONS_BY_ANCHOR_SET(
          hashAnchors(anchorIds),
          MAX_PAIRS_PER_ANCHOR
        )

  try {
    return await getCachedData(
      key,
      CACHE_TTL.RECOMMENDATIONS,
      () => fetchScoredCandidates(anchorIds),
      CACHE_TTL.RECOMMENDATIONS_STALE
    )
  } catch (error) {
    logError({
      error,
      context: 'recommendation_score_read',
      additionalInfo: { anchorIds: [...anchorIds] },
    })
    return []
  }
}

/**
 * Category-scoped bestsellers, the platform's existing cold-start answer.
 *
 * Over-fetches so the eligibility predicate has candidates left after
 * filtering, then truncates to the rail size.
 */
export const resolveBestsellerFallback = async (
  limit: number,
  context: EligibilityContext & { readonly category?: string | null }
): Promise<RecommendationItem[]> => {
  const fetchBestsellers = async (category?: string) =>
    db.products.findBestsellers({
      limit: limit + MAX_PAIRS_PER_ANCHOR,
      ...(category ? { category } : {}),
    })

  let candidates = await fetchBestsellers(context.category ?? undefined)

  // A narrow category can be exhausted by the exclusions; fall back to the
  // whole catalog rather than render an empty rail (SC-001).
  if (context.category && candidates.length === 0) {
    candidates = await fetchBestsellers()
  }

  return candidates
    .map(productToRecommendationItem)
    .filter((item) =>
      isEligibleCandidate(
        { ...item, sellableStock: item.inStock ? 1 : 0 },
        context
      )
    )
    .slice(0, limit)
}

interface RailOptions extends EligibilityContext {
  readonly surface: RecommendationSurface
  readonly anchorIds: readonly string[]
  readonly limit?: number
  readonly category?: string | null
}

/**
 * Shared resolution for every surface: read scores, filter, then fall back.
 *
 * The fallback fires on three conditions — no rows for the anchors, every
 * candidate filtered out, or the score read failing — so a rail is empty only
 * when the catalog itself has nothing to show.
 */
const resolveRail = async (
  options: RailOptions
): Promise<RecommendationResult> => {
  const limit = options.limit ?? RAIL_SIZE
  const context: EligibilityContext & { category?: string | null } = {
    anchorProductId: options.anchorProductId ?? null,
    excludeProductIds: options.excludeProductIds,
    category: options.category,
  }

  const scored = await readScoresCached(options.anchorIds)

  if (scored.length > 0) {
    const candidates = await loadCandidates(
      scored.map((entry) => entry.recommendedProductId)
    )

    const eligible: RecommendationItem[] = []
    for (const entry of scored) {
      const candidate = candidates.get(entry.recommendedProductId)
      if (!candidate) continue
      if (!isEligibleCandidate(candidate, context)) continue
      eligible.push(toRecommendationItem(candidate))
      if (eligible.length === limit) break
    }

    if (eligible.length > 0) {
      return { surface: options.surface, fallback: false, products: eligible }
    }
  }

  return {
    surface: options.surface,
    fallback: true,
    products: await resolveBestsellerFallback(limit, context),
  }
}

/** Related products for a product detail page. */
export const getProductRail = async (
  anchorProductId: string,
  options: { readonly category?: string | null; readonly limit?: number } = {}
): Promise<RecommendationResult> =>
  resolveRail({
    surface: 'product',
    anchorIds: [anchorProductId],
    anchorProductId,
    category: options.category,
    limit: options.limit,
  })

/**
 * Cross-sell for the cart.
 *
 * Every cart product is both an anchor and an exclusion: suggestions derive
 * from the whole basket but never re-suggest what is already in it. An empty
 * cart yields an empty rail rather than bestsellers, because there is nothing
 * to cross-sell against.
 */
export const getCartRail = async (
  cartProductIds: readonly string[],
  options: { readonly limit?: number } = {}
): Promise<RecommendationResult> => {
  if (cartProductIds.length === 0) {
    return { surface: 'cart', fallback: false, products: [] }
  }

  return resolveRail({
    surface: 'cart',
    anchorIds: cartProductIds,
    excludeProductIds: new Set(cartProductIds),
    limit: options.limit,
  })
}

/**
 * Personalised rail for the `/shop` landing page.
 *
 * Anchors are the shopper's own order and wishlist products, unioned with the
 * recently-viewed seeds the browser supplied. Seeds are never persisted, so a
 * guest leaves no profile behind.
 */
export const getHomeRail = async (
  anchorIds: readonly string[],
  options: { readonly limit?: number } = {}
): Promise<RecommendationResult> => {
  const unique = [...new Set(anchorIds)]

  return resolveRail({
    surface: 'home',
    anchorIds: unique,
    // Already-owned or already-seen products are poor recommendations.
    excludeProductIds: new Set(unique),
    limit: options.limit,
  })
}

/**
 * Recovery for a search that returned nothing.
 *
 * Respects an active category filter so the suggestions never override the
 * shopper's stated intent.
 */
export const getZeroResultRail = async (
  options: {
    readonly category?: string | null
    readonly anchorIds?: readonly string[]
    readonly limit?: number
  } = {}
): Promise<RecommendationResult> =>
  resolveRail({
    surface: 'zero_result',
    anchorIds: options.anchorIds ?? [],
    category: options.category,
    limit: options.limit,
  })
