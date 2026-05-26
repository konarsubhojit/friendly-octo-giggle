import { NextRequest } from 'next/server'
import { drizzleDb } from '@/lib/db'
import { orderItems, orders, reviews, reviewVotes } from '@/lib/schema'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { auth } from '@/lib/auth'
import {
  CreateReviewSchema,
  UpdateReviewSchema,
} from '@/features/product/validations'
import { withLogging } from '@/lib/api-middleware'

export const dynamic = 'force-dynamic'

const handleGet = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')
  const sort = searchParams.get('sort') ?? 'recent'
  const ratingFilter = searchParams.get('rating')
  const verifiedOnly = searchParams.get('verified') === 'true'

  if (!productId) {
    return apiError('productId query parameter is required', 400)
  }

  try {
    const session = await auth()
    const conditions = [
      eq(reviews.productId, productId),
      eq(reviews.isHidden, false),
    ]

    if (ratingFilter) {
      const parsed = Number.parseInt(ratingFilter, 10)
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        conditions.push(eq(reviews.rating, parsed))
      }
    }

    if (verifiedOnly) {
      conditions.push(eq(reviews.isVerifiedBuyer, true))
    }

    const orderBy =
      sort === 'top'
        ? [desc(reviews.rating), desc(reviews.createdAt)]
        : sort === 'helpful'
          ? [desc(reviews.helpfulCount), desc(reviews.createdAt)]
          : [desc(reviews.isFeatured), desc(reviews.createdAt)]

    const productReviews = await drizzleDb.query.reviews.findMany({
      where: and(...conditions),
      orderBy,
      with: { user: { columns: { name: true, image: true } } },
    })

    const sessionUserId = session?.user?.id ?? null
    const voteMap = new Map<string, number>()
    if (sessionUserId && productReviews.length > 0) {
      const votes = await drizzleDb.query.reviewVotes.findMany({
        where: and(
          eq(reviewVotes.userId, sessionUserId),
          inArray(
            reviewVotes.reviewId,
            productReviews.map((review) => review.id)
          )
        ),
      })
      votes.forEach((vote) => {
        voteMap.set(vote.reviewId, vote.vote)
      })
    }

    const ratingBreakdown = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: productReviews.filter((review) => review.rating === rating).length,
    }))

    const serialized = productReviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      user: r.isAnonymous ? null : r.user,
      isOwnReview: Boolean(sessionUserId && r.userId === sessionUserId),
      userVote:
        voteMap.get(r.id) === 1
          ? 'up'
          : voteMap.get(r.id) === -1
            ? 'down'
            : null,
    }))

    return apiSuccess(
      {
        reviews: serialized,
        summary: {
          totalReviews: productReviews.length,
          averageRating:
            productReviews.length > 0
              ? Number(
                  (
                    productReviews.reduce(
                      (sum, review) => sum + review.rating,
                      0
                    ) / productReviews.length
                  ).toFixed(1)
                )
              : 0,
          ratingBreakdown,
        },
      },
      200,
      {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

const handlePost = async (request: NextRequest) => {
  const session = await auth()
  if (!session?.user) {
    return apiError('Authentication required to submit a review', 401)
  }

  try {
    const { productId, orderId, rating, comment, isAnonymous } =
      await parseJsonBody(request, CreateReviewSchema)

    const existing = await drizzleDb.query.reviews.findFirst({
      where: and(
        eq(reviews.userId, session.user.id),
        eq(reviews.productId, productId)
      ),
    })

    if (existing) {
      return apiError('You have already reviewed this product', 409)
    }

    const purchaseConditions = [
      eq(orderItems.productId, productId),
      eq(orders.userId, session.user.id),
    ]
    if (orderId) {
      purchaseConditions.push(eq(orderItems.orderId, orderId))
    }

    const matchedPurchase = await drizzleDb
      .select({ orderId: orderItems.orderId })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(...purchaseConditions))
      .orderBy(asc(orders.createdAt))
      .limit(1)

    const verifiedOrderId = matchedPurchase[0]?.orderId ?? null

    const [review] = await drizzleDb
      .insert(reviews)
      .values({
        productId,
        orderId: verifiedOrderId,
        userId: session.user.id,
        rating,
        comment,
        isAnonymous: isAnonymous ?? false,
        isVerifiedBuyer: Boolean(verifiedOrderId),
        updatedAt: new Date(),
      })
      .returning()

    return apiSuccess(
      {
        review: {
          ...review,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
        },
      },
      201
    )
  } catch (error) {
    const dbError = error as Error & { code?: unknown; constraint?: unknown }
    const isUniqueViolation =
      error instanceof Error &&
      ('code' in error || 'constraint' in error) &&
      (String(dbError.code) === '23505' ||
        String(
          typeof dbError.constraint === 'string' ? dbError.constraint : ''
        ).includes('userId_productId'))
    if (isUniqueViolation) {
      return apiError('You have already reviewed this product', 409)
    }
    return handleApiError(error)
  }
}

export const GET = withLogging(handleGet)
export const POST = withLogging(handlePost)

export const PATCH = withLogging(async (request: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError('Authentication required to update a review', 401)
  }

  try {
    const reviewId = new URL(request.url).searchParams.get('id')
    if (!reviewId) {
      return apiError('id query parameter is required', 400)
    }

    const existing = await drizzleDb.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })
    if (!existing) {
      return apiError('Review not found', 404)
    }
    if (existing.userId !== session.user.id) {
      return apiError('You can only edit your own reviews', 403)
    }

    const { rating, comment, isAnonymous } = await parseJsonBody(
      request,
      UpdateReviewSchema
    )

    const [updated] = await drizzleDb
      .update(reviews)
      .set({
        rating,
        comment,
        isAnonymous,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning()

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
})

export const DELETE = withLogging(async (request: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError('Authentication required to delete a review', 401)
  }

  try {
    const reviewId = new URL(request.url).searchParams.get('id')
    if (!reviewId) {
      return apiError('id query parameter is required', 400)
    }

    const existing = await drizzleDb.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })
    if (!existing) {
      return apiError('Review not found', 404)
    }
    if (existing.userId !== session.user.id) {
      return apiError('You can only delete your own reviews', 403)
    }

    await drizzleDb.delete(reviews).where(eq(reviews.id, reviewId))
    return apiSuccess({ deleted: true }, 200)
  } catch (error) {
    return handleApiError(error)
  }
})
