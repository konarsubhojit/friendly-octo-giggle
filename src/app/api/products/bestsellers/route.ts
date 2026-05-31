import { db } from '@/lib/db'
import { apiSuccess, handleApiError } from '@/lib/api-utils'
import { withLogging } from '@/lib/api-middleware'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { cacheProductsBestsellers, buildPublicCacheHeader } from '@/lib/cache'

/**
 * GET /api/products/bestsellers
 *
 * Returns products sorted by total units sold (from non-cancelled orders),
 * descending. Products with no sales appear at the end ordered by creation date.
 *
 * Query params:
 * - `limit` (optional): number of products to return (1-100). Defaults to 5.
 *
 * Results are Redis-cached (see `CACHE_TTL.PRODUCTS_BESTSELLERS`) and the
 * HTTP response is CDN-cacheable for a shorter window because admin product
 * mutations do not invalidate the Vercel CDN cache.
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
    response.headers.set('Cache-Control', buildPublicCacheHeader(120))
    return response
  } catch (error) {
    return handleApiError(error)
  }
}

export const GET = withLogging(handleGet)
