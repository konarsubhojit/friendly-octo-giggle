import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import {
  SEARCH_SORT_VALUES,
  SEARCH_VARIANT_VALUES,
  searchCatalog,
} from '@/lib/search-discovery'

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  minRating: z.coerce.number().min(0).max(5).optional(),
  variant: z.enum(SEARCH_VARIANT_VALUES).optional().default('all'),
  sort: z.enum(SEARCH_SORT_VALUES).optional().default('relevance'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * GET /api/search?q=crochet+flower&category=Flowers&sort=price_asc&minPrice=100
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())

    const parseResult = SearchQuerySchema.safeParse(params)
    if (!parseResult.success) {
      return apiError('Invalid search parameters', 400, {
        issues: parseResult.error.issues,
      })
    }

    const data = await searchCatalog(parseResult.data)

    const response = apiSuccess({
      ...data,
      type: 'products',
    })

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60'
    )

    return response
  } catch (error) {
    return handleApiError(error)
  }
}
