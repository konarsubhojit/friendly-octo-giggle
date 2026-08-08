import { NextRequest } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { drizzleDb } from '@/lib/db'
import { orderItems, orders, wishlists } from '@/lib/schema'
import { apiError, apiSuccess, handleApiError } from '@/lib/api-utils'
import { RAIL_SIZE } from '@/features/recommendations/constants'
import {
  getHomeRail,
  resolveBestsellerFallback,
} from '@/features/recommendations/services/selection'
import { PersonalizedQuerySchema } from '@/features/recommendations/validations'

/** How many of the shopper's own products are used as anchors. */
const MAX_HISTORY_ANCHORS = 12

/**
 * Products the shopper has bought or wishlisted, most recent first.
 *
 * Scoped to `userId` in both queries, so one shopper can never anchor on
 * another's history.
 */
const loadOwnAnchors = async (userId: string): Promise<string[]> => {
  const [purchased, wishlisted] = await Promise.all([
    drizzleDb
      .select({ productId: orderItems.productId })
      .from(orderItems)
      .innerJoin(
        orders,
        and(eq(orders.id, orderItems.orderId), eq(orders.userId, userId))
      )
      .orderBy(desc(orders.createdAt))
      .limit(MAX_HISTORY_ANCHORS),
    drizzleDb
      .select({ productId: wishlists.productId })
      .from(wishlists)
      .where(eq(wishlists.userId, userId))
      .orderBy(desc(wishlists.createdAt))
      .limit(MAX_HISTORY_ANCHORS),
  ])

  return [
    ...purchased.map((row) => row.productId),
    ...wishlisted.map((row) => row.productId),
  ]
}

/**
 * Personalised rail for the `/shop` landing page.
 *
 * Guests are answered from bestsellers before any per-user read runs, so no
 * profile is created, persisted, or cached for them — the guarantee holds by
 * control flow rather than by cleanup.
 *
 * Deliberately never returns 401: an unauthenticated visitor gets the
 * anonymous rail. A rail must never be the reason a page shows an error.
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = PersonalizedQuerySchema.safeParse({
      seeds: request.nextUrl.searchParams.get('seeds') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return apiError('Invalid recommendation request', 400)
    }

    const { seeds, limit } = parsed.data
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      const products = await resolveBestsellerFallback(limit ?? RAIL_SIZE, {})
      return apiSuccess(
        { surface: 'home' as const, fallback: true, products },
        200,
        {
          'Cache-Control': 'public, max-age=60',
        }
      )
    }

    const anchors = [...new Set([...seeds, ...(await loadOwnAnchors(userId))])]
    const result = await getHomeRail(anchors, { limit })

    return apiSuccess(result, 200, { 'Cache-Control': 'private, no-store' })
  } catch (error) {
    return handleApiError(error)
  }
}
