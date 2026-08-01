import { Suspense } from 'react'
import { notFound, unstable_rethrow } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'
import type { Metadata } from 'next'
import { Product } from '@/lib/types'
import ProductClient from './ProductClient'
import ProductDetailSkeleton from '@/components/skeletons/ProductDetailSkeleton'
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

/** Cached read plus the error degradation the cached scope must not absorb. */
async function getProduct(id: string): Promise<Product | null> {
  try {
    return await getCachedProduct(id)
  } catch (error) {
    unstable_rethrow(error)
    // Already logged inside the cached scope; treat as "not found".
    return null
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
  const [{ v: initialVariantId }, aiEnabled] = await Promise.all([
    searchParams,
    isAiEnabled(),
  ])

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
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail product={product} searchParams={searchParams} />
    </Suspense>
  )
}

export default ProductPage
