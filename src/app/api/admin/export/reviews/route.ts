import { asc } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { reviews } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { streamCsvResponse } from '@/features/admin/services/admin-csv'
import { apiError, handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export const GET = async () => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const rows = await drizzleDb.query.reviews.findMany({
      orderBy: [asc(reviews.createdAt)],
    })

    return streamCsvResponse(
      'reviews.csv',
      [
        'id',
        'productId',
        'userId',
        'rating',
        'comment',
        'isFeatured',
        'isHidden',
        'createdAt',
      ],
      rows.map((review) => [
        review.id,
        review.productId,
        review.userId,
        review.rating,
        review.comment,
        review.isFeatured,
        review.isHidden,
        review.createdAt.toISOString(),
      ])
    )
  } catch (error) {
    return handleApiError(error)
  }
}
