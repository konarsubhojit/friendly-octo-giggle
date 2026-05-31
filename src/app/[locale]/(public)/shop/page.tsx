import type { Metadata } from 'next'
import Footer from '@/components/layout/Footer'
import ProductGrid, {
  type ProductGridItem,
} from '@/features/product/components/ProductGrid'
import { BestsellersScroller } from '@/features/product/components/BestsellersScroller'
import { db, drizzleDb } from '@/lib/db'
import { cacheCategoriesList, cacheProductsBestsellers } from '@/lib/cache'
import { categories as categoriesTable } from '@/lib/schema'
import { isNull, asc } from 'drizzle-orm'
import { logError } from '@/lib/logger'
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
  title: 'Shop | The Kiyon Store',
  description:
    'Browse our full collection of handmade crochet flowers, bags, keychains, hair accessories, and more.',
}

const ShopPage = async ({ searchParams }: ShopPageProps) => {
  const resolvedSearchParams = (await searchParams) ?? {}
  const search = getSingleValue(resolvedSearchParams.q)?.trim() ?? ''
  const selectedCategory =
    getSingleValue(resolvedSearchParams.category)?.trim() ?? 'All'
  const rawSort = getSingleValue(resolvedSearchParams.sort)?.trim()
  const selectedSort: SearchSort =
    rawSort && SEARCH_SORT_VALUES.includes(rawSort as SearchSort)
      ? (rawSort as SearchSort)
      : 'relevance'
  const rawMinPrice = Number.parseFloat(
    getSingleValue(resolvedSearchParams.minPrice) ?? ''
  )
  const rawMaxPrice = Number.parseFloat(
    getSingleValue(resolvedSearchParams.maxPrice) ?? ''
  )
  const minPrice = Number.isFinite(rawMinPrice) ? rawMinPrice : undefined
  const maxPrice = Number.isFinite(rawMaxPrice) ? rawMaxPrice : undefined
  const inStock = getSingleValue(resolvedSearchParams.inStock) === 'true'
  const rawMinRating = Number.parseFloat(
    getSingleValue(resolvedSearchParams.minRating) ?? ''
  )
  const minRating = Number.isFinite(rawMinRating) ? rawMinRating : undefined
  const rawVariant = getSingleValue(resolvedSearchParams.variant)?.trim()
  const selectedVariant: SearchVariantFilter =
    rawVariant &&
    SEARCH_VARIANT_VALUES.includes(rawVariant as SearchVariantFilter)
      ? (rawVariant as SearchVariantFilter)
      : 'all'

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
      cacheProductsBestsellers(() => db.products.findBestsellers(), 5),
      cacheCategoriesList(() =>
        drizzleDb
          .select({ name: categoriesTable.name })
          .from(categoriesTable)
          .where(isNull(categoriesTable.deletedAt))
          .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name))
      ),
    ])

    const searchResult = await searchCatalog({
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
    })

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

      <Footer />
    </div>
  )
}

export default ShopPage
