import { and, avg, eq, ilike, inArray, isNull, sql } from 'drizzle-orm'
import { db, drizzleDb } from '@/lib/db'
import { logBusinessEvent } from '@/lib/logger'
import {
  categories,
  products,
  productVariants,
  reviews,
} from '@/lib/schema'
import { searchProductIdsCached } from '@/lib/search'

export const SEARCH_SORT_VALUES = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
  'best_selling',
  'top_rated',
] as const

export const SEARCH_VARIANT_VALUES = ['all', 'single', 'multiple'] as const

export type SearchSort = (typeof SEARCH_SORT_VALUES)[number]
export type SearchVariantFilter = (typeof SEARCH_VARIANT_VALUES)[number]

export interface SearchQueryOptions {
  q: string
  category?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  minRating?: number
  variant: SearchVariantFilter
  sort: SearchSort
  limit: number
  offset: number
}

export interface SearchResultProduct {
  id: string
  name: string
  description: string
  category: string
  image: string
  price: number
  stock: number
  soldCount: number
  createdAt: string
  rating: number
  variantCount: number
}

export interface SearchFacetCounts {
  categories: Array<{ value: string; count: number }>
  price: { min: number; max: number }
  stock: { inStock: number; outOfStock: number }
  ratings: {
    gte4: number
    gte3: number
    lt3: number
  }
  variants: {
    single: number
    multiple: number
  }
}

export interface SearchCatalogResult {
  query: string
  results: SearchResultProduct[]
  total: number
  facets: SearchFacetCounts
  sort: SearchSort
  fallbackUsed: boolean
  suggestions: string[]
  trending: Array<{
    id: string
    name: string
    category: string
  }>
}

const DEFAULT_POPULAR_SEARCHES = [
  'flower bouquet',
  'crochet bag',
  'keychain',
  'hair accessories',
]

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

const buildSpellSuggestions = (
  query: string,
  categoriesFromResults: string[]
): string[] => {
  const normalized = normalizeWhitespace(query).toLowerCase()
  if (!normalized) {
    return []
  }

  const source = [...new Set([...categoriesFromResults, ...DEFAULT_POPULAR_SEARCHES])]
  const byContainment = source.filter((term) =>
    term.toLowerCase().includes(normalized.slice(0, Math.max(2, normalized.length - 1)))
  )

  if (byContainment.length > 0) {
    return byContainment.slice(0, 3)
  }

  return source.slice(0, 3)
}

const aggregateFacets = (productsList: SearchResultProduct[]): SearchFacetCounts => {
  const categoryCounts = new Map<string, number>()

  let min = Number.POSITIVE_INFINITY
  let max = 0
  let inStock = 0
  let outOfStock = 0
  let gte4 = 0
  let gte3 = 0
  let lt3 = 0
  let single = 0
  let multiple = 0

  for (const product of productsList) {
    categoryCounts.set(
      product.category,
      (categoryCounts.get(product.category) ?? 0) + 1
    )

    min = Math.min(min, product.price)
    max = Math.max(max, product.price)

    if (product.stock > 0) {
      inStock += 1
    } else {
      outOfStock += 1
    }

    if (product.rating >= 4) {
      gte4 += 1
    }
    if (product.rating >= 3) {
      gte3 += 1
    }
    if (product.rating < 3) {
      lt3 += 1
    }

    if (product.variantCount <= 1) {
      single += 1
    } else {
      multiple += 1
    }
  }

  return {
    categories: Array.from(categoryCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    price: {
      min: Number.isFinite(min) ? min : 0,
      max,
    },
    stock: { inStock, outOfStock },
    ratings: { gte4, gte3, lt3 },
    variants: { single, multiple },
  }
}

const applyFilters = (
  productsList: SearchResultProduct[],
  options: SearchQueryOptions
): SearchResultProduct[] => {
  return productsList.filter((product) => {
    if (
      typeof options.minPrice === 'number' &&
      Number.isFinite(options.minPrice) &&
      product.price < options.minPrice
    ) {
      return false
    }

    if (
      typeof options.maxPrice === 'number' &&
      Number.isFinite(options.maxPrice) &&
      product.price > options.maxPrice
    ) {
      return false
    }

    if (options.inStock === true && product.stock <= 0) {
      return false
    }

    if (
      typeof options.minRating === 'number' &&
      Number.isFinite(options.minRating) &&
      product.rating < options.minRating
    ) {
      return false
    }

    if (options.variant === 'single' && product.variantCount > 1) {
      return false
    }

    if (options.variant === 'multiple' && product.variantCount <= 1) {
      return false
    }

    return true
  })
}

const applySort = (
  productsList: SearchResultProduct[],
  sort: SearchSort,
  relevanceOrder: Map<string, number>
): SearchResultProduct[] => {
  const sorted = [...productsList]

  if (sort === 'relevance') {
    sorted.sort((a, b) => {
      const rankA = relevanceOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER
      const rankB = relevanceOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER
      return rankA - rankB || b.soldCount - a.soldCount
    })
    return sorted
  }

  const comparators: Record<SearchSort, (a: SearchResultProduct, b: SearchResultProduct) => number> = {
    relevance: () => 0,
    price_asc: (a, b) => a.price - b.price || b.soldCount - a.soldCount,
    price_desc: (a, b) => b.price - a.price || b.soldCount - a.soldCount,
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    best_selling: (a, b) => b.soldCount - a.soldCount || b.rating - a.rating,
    top_rated: (a, b) => b.rating - a.rating || b.soldCount - a.soldCount,
  }

  sorted.sort(comparators[sort])
  return sorted
}

const attachRatingsAndVariantCounts = async (
  productsList: SearchResultProduct[]
): Promise<SearchResultProduct[]> => {
  if (productsList.length === 0) {
    return []
  }

  const ids = productsList.map((product) => product.id)

  const [ratingsRows, variantsRows] = await Promise.all([
    drizzleDb
      .select({
        productId: reviews.productId,
        rating: sql<number>`cast(coalesce(${avg(reviews.rating)}, 0) as float)`,
      })
      .from(reviews)
      .where(and(inArray(reviews.productId, ids), eq(reviews.isHidden, false)))
      .groupBy(reviews.productId),
    drizzleDb
      .select({
        productId: productVariants.productId,
        variantCount: sql<number>`cast(count(*) as int)`,
      })
      .from(productVariants)
      .where(
        and(
          inArray(productVariants.productId, ids),
          isNull(productVariants.deletedAt)
        )
      )
      .groupBy(productVariants.productId),
  ])

  const ratingById = new Map(ratingsRows.map((row) => [row.productId, row.rating]))
  const variantCountById = new Map(
    variantsRows.map((row) => [row.productId, row.variantCount])
  )

  return productsList.map((product) => ({
    ...product,
    rating: ratingById.get(product.id) ?? 0,
    variantCount: variantCountById.get(product.id) ?? product.variantCount,
  }))
}

const fetchTrendingProducts = async () => {
  const bestsellers = await db.products.findBestsellers({ limit: 5 })
  return bestsellers.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
  }))
}

async function searchCandidates(
  options: SearchQueryOptions
): Promise<{ products: SearchResultProduct[]; fallbackUsed: boolean; relevanceOrder: Map<string, number> }> {
  const candidateLimit = Math.min(Math.max(options.offset + options.limit + 20, 60), 200)
  const normalizedCategory = options.category?.trim()
  const normalizedQuery = normalizeWhitespace(options.q)

  if (normalizedQuery && options.sort === 'relevance') {
    const matchedIds = await searchProductIdsCached(normalizedQuery, {
      category: normalizedCategory,
      limit: candidateLimit,
    })

    if (matchedIds !== null) {
      const matchedProducts = await db.products.findMinimalByIds(
        matchedIds,
        normalizedCategory
      )
      const orderedMap = new Map(matchedIds.map((id, index) => [id, index]))

      const productRows = await drizzleDb
        .select({ id: products.id, createdAt: products.createdAt })
        .from(products)
        .where(inArray(products.id, matchedProducts.map((product) => product.id)))

      const createdAtById = new Map(
        productRows.map((row) => [row.id, row.createdAt.toISOString()])
      )

      const mapped = matchedProducts
        .map((product) => ({
          ...product,
          createdAt: createdAtById.get(product.id) ?? new Date(0).toISOString(),
          rating: 0,
          variantCount: 0,
        }))
        .sort(
          (a, b) =>
            (orderedMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (orderedMap.get(b.id) ?? Number.MAX_SAFE_INTEGER)
        )

      return {
        products: await attachRatingsAndVariantCounts(mapped),
        fallbackUsed: false,
        relevanceOrder: orderedMap,
      }
    }
  }

  const dbRows = await db.products.findAllMinimal({
    limit: candidateLimit,
    offset: 0,
    search: normalizedQuery || undefined,
    category: normalizedCategory,
  })

  const productRows = await drizzleDb
    .select({ id: products.id, createdAt: products.createdAt })
    .from(products)
    .where(inArray(products.id, dbRows.map((product) => product.id)))

  const createdAtById = new Map(
    productRows.map((row) => [row.id, row.createdAt.toISOString()])
  )

  const mapped = dbRows.map((product) => ({
    ...product,
    createdAt: createdAtById.get(product.id) ?? new Date(0).toISOString(),
    rating: 0,
    variantCount: 0,
  }))

  return {
    products: await attachRatingsAndVariantCounts(mapped),
    fallbackUsed: true,
    relevanceOrder: new Map(),
  }
}

export async function searchCatalog(
  options: SearchQueryOptions
): Promise<SearchCatalogResult> {
  const normalizedQuery = normalizeWhitespace(options.q)
  const { products: candidates, fallbackUsed, relevanceOrder } =
    await searchCandidates({ ...options, q: normalizedQuery })

  const facets = aggregateFacets(candidates)
  const filtered = applyFilters(candidates, options)
  const sorted = applySort(filtered, options.sort, relevanceOrder)

  const total = sorted.length
  const paged = sorted.slice(options.offset, options.offset + options.limit)

  const suggestions =
    total === 0 && normalizedQuery
      ? buildSpellSuggestions(
          normalizedQuery,
          facets.categories.map((category) => category.value)
        )
      : []

  const trending = total === 0 ? await fetchTrendingProducts() : []

  if (total === 0 && normalizedQuery) {
    logBusinessEvent({
      event: 'search_zero_results',
      details: {
        query: normalizedQuery,
        category: options.category ?? null,
        sort: options.sort,
      },
      success: true,
    })
  }

  return {
    query: normalizedQuery,
    results: paged,
    total,
    facets,
    sort: options.sort,
    fallbackUsed,
    suggestions,
    trending,
  }
}

export async function suggestSearchTerms(query: string, limit = 8) {
  const normalizedQuery = normalizeWhitespace(query)
  if (!normalizedQuery) {
    return {
      query: '',
      products: [] as Array<{ id: string; label: string; category: string }>,
      categories: [] as string[],
      popular: DEFAULT_POPULAR_SEARCHES,
    }
  }

  const matchedIds = await searchProductIdsCached(normalizedQuery, { limit })
  const matchedProducts =
    matchedIds === null
      ? await db.products.findAllMinimal({
          search: normalizedQuery,
          limit,
          offset: 0,
        })
      : await db.products.findMinimalByIds(matchedIds.slice(0, limit))

  const matchedCategories = await drizzleDb
    .select({ name: categories.name })
    .from(categories)
    .where(ilike(categories.name, `%${normalizedQuery}%`))
    .limit(limit)

  return {
    query: normalizedQuery,
    products: matchedProducts.slice(0, limit).map((product) => ({
      id: product.id,
      label: product.name,
      category: product.category,
    })),
    categories: [...new Set(matchedCategories.map((category) => category.name))],
    popular: DEFAULT_POPULAR_SEARCHES,
  }
}
