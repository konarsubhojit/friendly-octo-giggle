import { db } from '@/lib/db'
import { apiSuccess, handleApiError } from '@/lib/api-utils'
import { withLogging } from '@/lib/api-middleware'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { cacheProductsBestsellers } from '@/lib/cache'

/**
 * GET /api/products/bestsellers
 *
 * Returns products sorted by total units sold (from non-cancelled orders),
 * descending. Products with no sales appear at the end ordered by creation date.
 *
 * Query params:
 * - `limit` (optional): number of products to return (1-100). Defaults to 5.
 *
 * Results are Redis-cached for 2 minutes with a 20-second stale window.
 */
const BestsellersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(5),
})

const handleGet = async (request: NextRequest) => {
  try {
    const parsed = BestsellersQuerySchema.parse({
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    })

    const products = await cacheProductsBestsellers(
      () => db.products.findBestsellers({ limit: parsed.limit }),
      parsed.limit
    )

    const response = apiSuccess({ products })
    response.headers.set(
      'Cache-Control',
      's-maxage=120, stale-while-revalidate=60'
    )
    return response
  } catch (error) {
    return handleApiError(error)
  }
}

export const GET = withLogging(handleGet)
