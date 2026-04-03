import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/wishlist/[productId]
 * Removes a product from the authenticated user's wishlist.
 */
export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) => {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const { productId } = await params

    if (!productId) {
      return apiError('productId is required', 400)
    }

    await db.wishlists.remove(session.user.id, productId)

    return apiSuccess({ productId })
  } catch (error) {
    logError({ error, context: 'wishlist_remove' })
    return handleApiError(error)
  }
}
