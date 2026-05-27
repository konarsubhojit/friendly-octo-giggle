import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError, apiSuccess, handleApiError } from '@/lib/api-utils'
import { suggestSearchTerms } from '@/lib/search-discovery'
import { getCachedData } from '@/lib/redis'

const SearchSuggestSchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(10).default(8),
})

const buildSuggestCacheKey = (query: string, limit: number) =>
  `search:suggest:${encodeURIComponent(query.toLowerCase())}:${limit}`

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())

    const parseResult = SearchSuggestSchema.safeParse(params)
    if (!parseResult.success) {
      return apiError('Invalid suggest parameters', 400, {
        issues: parseResult.error.issues,
      })
    }

    const { q, limit } = parseResult.data

    const data = await getCachedData(
      buildSuggestCacheKey(q, limit),
      30,
      () => suggestSearchTerms(q, limit),
      5
    )

    const response = apiSuccess(data)
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60'
    )

    return response
  } catch (error) {
    return handleApiError(error)
  }
}
