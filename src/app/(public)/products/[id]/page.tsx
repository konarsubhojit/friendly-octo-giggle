import { Suspense } from 'react'
import { notFound, unstable_rethrow } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'
import type { Metadata } from 'next'
import { Product } from '@/lib/types'
import ProductClient from './ProductClient'
import ProductDetailSkeleton from '@/components/skeletons/ProductDetailSkeleton'
import RecommendationRailSkeleton from '@/components/skeletons/RecommendationRailSkeleton'
import { ProductRecommendations } from '@/features/recommendations/components/RecommendationSections'
import { db } from '@/lib/db'
import { productTag } from '@/lib/cache-tags'
import { isAiEnabled } from '@/lib/edge-config'
import { logError } from '@/lib/logger'
import { withStoreName } from '@/lib/constants/store'

/**
 * Cached product read shared by `generateMetadata` and the page component.
 *
 * `"use cache"` replaces the previous React `cache()` wrapper: it still
 * deduplicates within a request, but additionally persists the result across
 * requests so the prerendered shell can be produced without a database round
 * trip. `db.products.findById(id, false)` bypasses the Redis product cache
 * because a cached scope must not nest a second cache layer with its own,
 * independent expiry.
 *
 * Errors are logged inside the scope — reading the current time (which the
 * logger does) is only permitted inside a cached scope during a prerender —
 * and rethrown so a failed read is never written to the cache.
 */
async function getCachedProduct(id: string): Promise<Product | null> {
  'use cache'
  cacheLife('product')
  cacheTag(productTag(id))

  try {
    return await db.products.findById(id, false)
  } catch (error) {
    logError({ error, context: 'product_fetch', additionalInfo: { id } })
    throw error
  }
}

/**
 * Number of product detail routes prerendered at build time (FR-011).
 *
 * Bounded deliberately: the set is the bestsellers rail extended to the top
 * `PREBUILT_PRODUCT_COUNT` products by sales volume, which is where search
 * results and shared links overwhelmingly land. Every other product is
 * generated on first request and retained by the `product` cache profile, so
 * raising this number buys build time rather than correctness.
 */
const PREBUILT_PRODUCT_COUNT = 20

/**
 * Stand-in param used when the catalog yields no ids at build time.
 *
 * Cache Components rejects an empty `generateStaticParams` outright
 * (`EmptyGenerateStaticParamsError`, Next.js E898), so "prerender nothing" is
 * not an expressible outcome. Prerendering one route that cannot exist is the
 * closest equivalent: product ids are 7-character Base62 short ids, so this
 * value can never shadow a real product, and the route it produces is the
 * `notFound()` page a request for a missing product would get anyway.
 */
const NO_PREBUILT_PRODUCTS_ID = '__no_products__'

/** Cached read plus the error degradation the cached scope must not absorb. */
async function getProduct(id: string): Promise<Product | null> {
  // The build-time stand-in is known not to exist, so it is resolved without
  // touching the database. That is what lets a build whose database is
  // unreachable still complete: the degraded params list contains only this
  // id, and rendering it needs no query that could fail.
  if (id === NO_PREBUILT_PRODUCTS_ID) return null

  try {
    return await getCachedProduct(id)
  } catch (error) {
    unstable_rethrow(error)
    // Already logged inside the cached scope; treat as "not found".
    return null
  }
}

/**
 * Prebuild the most-requested product detail routes.
 *
 * `withCache: false` keeps the build off Redis — build machines have no
 * guarantee of Upstash credentials, and a build-time cache write would expire
 * long before it was read. A database that is unreachable at build time
 * degrades to the stand-in above rather than failing the build, so every real
 * product is generated on demand instead (spec US4 acceptance 3).
 */
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  try {
    const topProducts = await db.products.findBestsellers({
      limit: PREBUILT_PRODUCT_COUNT,
      withCache: false,
    })
    if (topProducts.length === 0) return [{ id: NO_PREBUILT_PRODUCTS_ID }]
    return topProducts.map((product) => ({ id: product.id }))
  } catch (error) {
    unstable_rethrow(error)
    logError({ error, context: 'product_static_params' })
    return [{ id: NO_PREBUILT_PRODUCTS_ID }]
  }
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> => {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) return { title: 'Product Not Found' }
  return {
    title: withStoreName(product.name),
    description: product.description?.slice(0, 160),
  }
}

/**
 * Request-scoped region.
 *
 * `searchParams` (the `?v=` variant preselection) and the AI feature flag are
 * both per-request reads, so they stay behind the page's `Suspense` boundary.
 * The product itself is passed in from the cached scope above, so this region
 * streams without repeating the database read.
 */
async function ProductDetail({
  product,
  searchParams,
}: {
  readonly product: Product
  readonly searchParams: Promise<{ v?: string }>
}) {
  // Awaited in sequence, not with `Promise.all`. `isAiEnabled` reads
  // `Date.now()` for the Edge Config in-process TTL, and Cache Components only
  // permits reading the current time once request data has been read. Starting
  // both promises together would let the clock read win the race and fail the
  // prerender of every statically generated product route.
  const { v: initialVariantId } = await searchParams
  const aiEnabled = await isAiEnabled()

  return (
    <ProductClient
      product={product}
      initialVariantId={initialVariantId ?? null}
      aiEnabled={aiEnabled}
    />
  )
}

const ProductPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>
  readonly searchParams: Promise<{ v?: string }>
}) => {
  const { id } = await params
  const product = await getProduct(id)

  if (!product) {
    notFound()
  }

  return (
    <>
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetail product={product} searchParams={searchParams} />
      </Suspense>
      {/*
        Below the fold and in its own boundary, so the rail streams after the
        product has painted. It is never awaited in the page body, which is
        what keeps it off the LCP path.
      */}
      <Suspense fallback={<RecommendationRailSkeleton />}>
        <ProductRecommendations
          anchorProductId={product.id}
          category={product.category}
        />
      </Suspense>
    </>
  )
}

export default ProductPage
