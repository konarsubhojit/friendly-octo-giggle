import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { reviews } from '@/lib/schema'
import { apiError, apiSuccess, handleApiError, parseJsonBody } from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { ModerateReviewSchema } from '@/features/product/validations'
import { withLogging } from '@/lib/api-middleware'

const handlePatch = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id } = await params
    const payload = await parseJsonBody(request, ModerateReviewSchema)

    if (
      typeof payload.isFeatured !== 'boolean' &&
      typeof payload.isHidden !== 'boolean'
    ) {
      return apiError('At least one moderation field is required', 400)
    }

    const [updated] = await drizzleDb
      .update(reviews)
      .set({
        ...(typeof payload.isFeatured === 'boolean'
          ? { isFeatured: payload.isFeatured }
          : {}),
        ...(typeof payload.isHidden === 'boolean'
          ? { isHidden: payload.isHidden }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning()

    if (!updated) {
      return apiError('Review not found', 404)
    }

    return apiSuccess(
      {
        review: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
      200
    )
  } catch (error) {
    return handleApiError(error)
  }
}

const handleDelete = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id } = await params

    const [deleted] = await drizzleDb
      .delete(reviews)
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id })

    if (!deleted) {
      return apiError('Review not found', 404)
    }

    return apiSuccess({ deleted: true, id }, 200)
  } catch (error) {
    return handleApiError(error)
  }
}

export const PATCH = withLogging(handlePatch)
export const DELETE = withLogging(handleDelete)
