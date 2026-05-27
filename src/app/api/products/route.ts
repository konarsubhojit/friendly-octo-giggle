import { NextRequest } from 'next/server'
import { apiSuccess, handleApiError } from '@/lib/api-utils'
import { withLogging } from '@/lib/api-middleware'
import { cacheProductsList } from '@/lib/cache'
import {
  SEARCH_SORT_VALUES,
  SEARCH_VARIANT_VALUES,
  type SearchSort,
  type SearchVariantFilter,
  searchCatalog,
} from '@/lib/search-discovery'

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

const parseProductLimit = (raw: string | null): number =>
  Math.min(
    Math.max(
      1,
      Number.parseInt(raw ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    ),
    MAX_LIMIT
  )

async function handleGet(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('q')?.trim()
    const category = searchParams.get('category')?.trim()
    const sort = searchParams.get('sort')?.trim() ?? 'relevance'
    const minPrice = Number.parseFloat(searchParams.get('minPrice') ?? '')
    const maxPrice = Number.parseFloat(searchParams.get('maxPrice') ?? '')
    const inStock = searchParams.get('inStock') === 'true'
    const minRating = Number.parseFloat(searchParams.get('minRating') ?? '')
    const rawVariant = searchParams.get('variant')?.trim()
    const variant: SearchVariantFilter =
      rawVariant && SEARCH_VARIANT_VALUES.includes(rawVariant as SearchVariantFilter)
        ? (rawVariant as SearchVariantFilter)
        : 'all'
    const validSort: SearchSort =
      sort && SEARCH_SORT_VALUES.includes(sort as SearchSort)
        ? (sort as SearchSort)
        : 'relevance'
    const limit = parseProductLimit(searchParams.get('limit'))
    const offset = Math.max(
      0,
      Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0
    )

    const products = await cacheProductsList(
      () =>
        searchCatalog({
          q: search ?? '',
          category: category || undefined,
          sort: validSort,
          minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
          maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
          inStock,
          minRating: Number.isFinite(minRating) ? minRating : undefined,
          variant:
            variant,
          limit: limit + 1,
          offset,
        }),
      { limit: limit + 1, offset, search, category }
    )
    const hasMore = products.total > offset + limit

    const response = apiSuccess({
      products: products.results.slice(0, limit),
      hasMore,
    })
    response.headers.set(
      'Cache-Control',
      's-maxage=60, stale-while-revalidate=120'
    )
    return response
  } catch (error) {
    return handleApiError(error)
  }
}

export const GET = withLogging(handleGet)
