import { Suspense } from 'react'
import type { Metadata } from 'next'
import Footer from '@/components/layout/Footer'
import ProductGrid, {
  type ProductGridItem,
} from '@/features/product/components/ProductGrid'
import { BestsellersScroller } from '@/features/product/components/BestsellersScroller'
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton'
import { db, drizzleDb } from '@/lib/db'
import { cacheCategoriesList, cacheProductsBestsellers } from '@/lib/cache'
import { categories as categoriesTable } from '@/lib/schema'
import { isNull, asc } from 'drizzle-orm'
import { logError } from '@/lib/logger'
import { withTimeout } from '@/lib/redis'
import {
  getVariantMinPrice,
  getVariantTotalStock,
} from '@/features/product/variant-utils'
import {
  SEARCH_SORT_VALUES,
  SEARCH_VARIANT_VALUES,
  searchCatalog,
  type SearchSort,
  type SearchVariantFilter,
} from '@/lib/search-discovery'
import { withStoreName } from '@/lib/constants/store'

export const revalidate = 60

const SHOP_INITIAL_SIZE = 24
const SHOP_BATCH_SIZE = 20

/** Convert a Product (with variants) to a ProductGridItem with derived price/stock */
const toGridItem = (p: {
  id: string
  name: string
  description: string
  image: string
  category: string
  soldCount?: number
  variants?: Array<{ id: string; price: number; stock: number }>
}): ProductGridItem => ({
  id: p.id,
  name: p.name,
  description: p.description,
  image: p.image,
  category: p.category,
  price: getVariantMinPrice(p.variants),
  stock: getVariantTotalStock(p.variants),
  soldCount: p.soldCount ?? 0,
})

export interface ShopFilters {
  readonly search: string
  readonly selectedCategory: string
  readonly selectedSort: SearchSort
  readonly minPrice?: number
  readonly maxPrice?: number
  readonly inStock: boolean
  readonly minRating?: number
  readonly selectedVariant: SearchVariantFilter
}

interface ShopPageProps {
  readonly searchParams?: Promise<{
    q?: string | string[]
    category?: string | string[]
    sort?: string | string[]
    minPrice?: string | string[]
    maxPrice?: string | string[]
    inStock?: string | string[]
    minRating?: string | string[]
    variant?: string | string[]
  }>
}

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export const metadata: Metadata = {
  title: withStoreName('Shop'),
  description:
    'Browse our full collection of handmade crochet flowers, bags, keychains, hair accessories, and more.',
}

export function parseShopFilters(
  searchParams: NonNullable<Awaited<ShopPageProps['searchParams']>>
): ShopFilters {
  const search = getSingleValue(searchParams.q)?.trim() ?? ''
  const selectedCategory = getSingleValue(searchParams.category)?.trim() ?? 'All'
  const rawSort = getSingleValue(searchParams.sort)?.trim()
  const selectedSort: SearchSort =
    rawSort && SEARCH_SORT_VALUES.includes(rawSort as SearchSort)
      ? (rawSort as SearchSort)
      : 'relevance'
  const rawMinPrice = Number.parseFloat(
    getSingleValue(searchParams.minPrice) ?? ''
  )
  const rawMaxPrice = Number.parseFloat(
    getSingleValue(searchParams.maxPrice) ?? ''
  )
  const minPrice = Number.isFinite(rawMinPrice) ? rawMinPrice : undefined
  const maxPrice = Number.isFinite(rawMaxPrice) ? rawMaxPrice : undefined
  const inStock = getSingleValue(searchParams.inStock) === 'true'
  const rawMinRating = Number.parseFloat(
    getSingleValue(searchParams.minRating) ?? ''
  )
  const minRating = Number.isFinite(rawMinRating) ? rawMinRating : undefined
  const rawVariant = getSingleValue(searchParams.variant)?.trim()
  const selectedVariant: SearchVariantFilter =
    rawVariant &&
    SEARCH_VARIANT_VALUES.includes(rawVariant as SearchVariantFilter)
      ? (rawVariant as SearchVariantFilter)
      : 'all'

  return {
    search,
    selectedCategory,
    selectedSort,
    minPrice,
    maxPrice,
    inStock,
    minRating,
    selectedVariant,
  }
}

const SKELETON_IDS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const

/** Fallback for the streamed catalog region (bestsellers + product grid). */
function ShopCatalogFallback() {
  return (
    <>
      <section
        className="mx-auto w-full max-w-[96rem] px-4 pb-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
        aria-hidden="true"
      >
        <div className="h-9 w-48 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-64 bg-[var(--accent-blush)] rounded animate-pulse mb-5" />
        <div className="flex gap-4 overflow-hidden">
          {['b1', 'b2', 'b3', 'b4', 'b5'].map((id) => (
            <div key={id} className="w-44 shrink-0">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      </section>
      <section
        className="mx-auto w-full max-w-[96rem] px-4 pb-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
        aria-hidden="true"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SKELETON_IDS.map((id) => (
            <ProductCardSkeleton key={id} />
          ))}
        </div>
      </section>
    </>
  )
}

/**
 * Streamed data region. Doing all DB/cache work here (instead of in the page
 * body) lets the static shell — the page heading — flush immediately while the
 * catalog data is fetched, improving perceived LCP/TTFB (R2/R4).
 */
export async function ShopCatalog({
  filters,
}: {
  readonly filters: ShopFilters
}) {
  const {
    search,
    selectedCategory,
    selectedSort,
    minPrice,
    maxPrice,
    inStock,
    minRating,
    selectedVariant,
  } = filters

  let shopData: {
    products: ProductGridItem[]
    bestsellers: ProductGridItem[]
    categoryNames: string[]
    hasNextPage: boolean
    suggestions: string[]
    trending: Array<{ id: string; name: string; category: string }>
  } = {
    products: [],
    bestsellers: [],
    categoryNames: [],
    hasNextPage: false,
    suggestions: [],
    trending: [],
  }

  try {
    const selectedCategoryFilter =
      selectedCategory === 'All' ? undefined : selectedCategory

    const [topProducts, cats] = await Promise.all([
      withTimeout(
        cacheProductsBestsellers(() => db.products.findBestsellers(), 5),
        5_000,
        'shop_bestsellers'
      ),
      withTimeout(
        cacheCategoriesList(() =>
          drizzleDb
            .select({ name: categoriesTable.name })
            .from(categoriesTable)
            .where(isNull(categoriesTable.deletedAt))
            .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name))
        ),
        5_000,
        'shop_categories'
      ),
    ])

    const searchResult = await withTimeout(
      searchCatalog({
        q: search,
        category: selectedCategoryFilter,
        sort: selectedSort,
        minPrice,
        maxPrice,
        inStock,
        minRating,
        variant: selectedVariant,
        limit: SHOP_INITIAL_SIZE + 1,
        offset: 0,
      }),
      5_000,
      'shop_catalog_search'
    )

    shopData = {
      products: searchResult.results
        .slice(0, SHOP_INITIAL_SIZE)
        .map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          image: product.image,
          category: product.category,
          price: product.price,
          stock: product.stock,
          soldCount: product.soldCount,
        })),
      bestsellers: topProducts.map(toGridItem),
      categoryNames: cats.map((c) => c.name),
      hasNextPage: searchResult.total > SHOP_INITIAL_SIZE,
      suggestions: searchResult.suggestions,
      trending: searchResult.trending,
    }
  } catch (error) {
    logError({ error, context: 'shop_products_fetch' })
  }

  const {
    products,
    bestsellers,
    categoryNames,
    hasNextPage,
    suggestions,
    trending,
  } = shopData

  return (
    <>
      <section
        className="mx-auto w-full max-w-[96rem] px-4 pb-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
        aria-labelledby="shop-bestsellers-heading"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2
            id="shop-bestsellers-heading"
            className="font-cursive text-3xl sm:text-4xl font-bold text-[var(--foreground)]"
          >
            Bestsellers
          </h2>
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Top 5 by orders
          </span>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-5">
          Most purchased favorites from our community.
        </p>

        <BestsellersScroller bestsellers={bestsellers} />
      </section>

      <ProductGrid
        products={products}
        categories={categoryNames}
        search={search}
        selectedCategory={selectedCategory}
        selectedSort={selectedSort}
        minPrice={minPrice}
        maxPrice={maxPrice}
        inStock={inStock}
        minRating={minRating}
        variant={selectedVariant}
        suggestions={suggestions}
        trending={trending}
        hasNextPage={hasNextPage}
        batchSize={SHOP_BATCH_SIZE}
      />
    </>
  )
}

const ShopPage = async ({ searchParams }: ShopPageProps) => {
  const resolvedSearchParams = (await searchParams) ?? {}
  const filters = parseShopFilters(resolvedSearchParams)

  return (
    <div className="min-h-screen bg-warm-gradient">
      <section
        className="mx-auto w-full max-w-[96rem] px-4 pb-4 pt-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
        aria-labelledby="shop-heading"
      >
        <h1
          id="shop-heading"
          className="font-cursive text-4xl sm:text-5xl font-bold text-[var(--foreground)] mb-2 animate-fade-in-up"
        >
          Shop
        </h1>
        <p className="text-[var(--text-secondary)] mb-6 animate-fade-in-up animation-delay-100">
          Browse our handmade collection — each piece crafted with care.
        </p>
      </section>

      <Suspense fallback={<ShopCatalogFallback />}>
        <ShopCatalog filters={filters} />
      </Suspense>

      <Footer />
    </div>
  )
}

export default ShopPage
