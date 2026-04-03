import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/wishlist
 * Returns the authenticated user's wishlist product IDs and products.
 */
export const GET = async (_req: NextRequest) => {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const products = await db.wishlists.getProducts(session.user.id)
    const productIds = products.map((p) => p.id)

    return apiSuccess({ products, productIds })
  } catch (error) {
    logError({ error, context: 'wishlist_get' })
    return handleApiError(error)
  }
}

/**
 * POST /api/wishlist
 * Body: { productId: string }
 * Adds a product to the authenticated user's wishlist.
 */
export const POST = async (req: NextRequest) => {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const body = await req.json()
    const { productId } = body as { productId?: string }

    if (!productId || typeof productId !== 'string') {
      return apiError('productId is required', 400)
    }

    await db.wishlists.add(session.user.id, productId)

    return apiSuccess({ productId }, 201)
  } catch (error) {
    logError({ error, context: 'wishlist_add' })
    return handleApiError(error)
  }
}
