import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Product } from '@/lib/types'
import ProductClient from './ProductClient'
import { db } from '@/lib/db'
import { isAiEnabled } from '@/lib/edge-config'
import { logError } from '@/lib/logger'

export const revalidate = 60

/**
 * React `cache()` deduplicates this call within the same server request,
 * so both `generateMetadata` and the page component share a single DB query.
 */
const getProduct = cache(async (id: string): Promise<Product | null> => {
  try {
    const product = await db.products.findById(id)
    return product
  } catch (error) {
    logError({ error, context: 'product_fetch', additionalInfo: { id } })
    return null
  }
})

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> => {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) return { title: 'Product Not Found' }
  return {
    title: `${product.name} | The Kiyon Store`,
    description: product.description?.slice(0, 160),
  }
}

const ProductPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>
  readonly searchParams: Promise<{ v?: string }>
}) => {
  const [{ id }, { v: initialVariationId }] = await Promise.all([
    params,
    searchParams,
  ])
  const [product, aiEnabled] = await Promise.all([
    getProduct(id),
    isAiEnabled(),
  ])

  if (!product) {
    notFound()
  }

  return (
    <ProductClient
      product={product}
      initialVariationId={initialVariationId ?? null}
      aiEnabled={aiEnabled}
    />
  )
}

export default ProductPage
