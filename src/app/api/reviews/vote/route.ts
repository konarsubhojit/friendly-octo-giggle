import { NextRequest } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import {
  parseJsonBody,
  apiError,
  apiSuccess,
  handleApiError,
} from '@/lib/api-utils'
import { drizzleDb } from '@/lib/db'
import { reviews, reviewVotes } from '@/lib/schema'
import { VoteReviewSchema } from '@/features/product/validations'
import { withLogging } from '@/lib/api-middleware'
import { SHORT_ID_REGEX } from '@/lib/validations'

const VotePayloadSchema = VoteReviewSchema.extend({
  reviewId: z.string().regex(SHORT_ID_REGEX, 'Invalid review ID'),
})

const handlePost = async (request: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return apiError('Authentication required to vote on reviews', 401)
  }

  try {
    const { reviewId, vote } = await parseJsonBody(request, VotePayloadSchema)
    const voteValue = vote === 'up' ? 1 : -1

    const review = await drizzleDb.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    })
    if (!review || review.isHidden) {
      return apiError('Review not found', 404)
    }

    const existingVote = await drizzleDb.query.reviewVotes.findFirst({
      where: and(
        eq(reviewVotes.reviewId, reviewId),
        eq(reviewVotes.userId, session.user.id)
      ),
    })

    if (!existingVote) {
      await drizzleDb.transaction(async (tx) => {
        await tx.insert(reviewVotes).values({
          reviewId,
          userId: session.user.id,
          vote: voteValue,
          updatedAt: new Date(),
        })
        await tx
          .update(reviews)
          .set({
            helpfulCount:
              voteValue === 1
                ? sql`${reviews.helpfulCount} + 1`
                : reviews.helpfulCount,
            notHelpfulCount:
              voteValue === -1
                ? sql`${reviews.notHelpfulCount} + 1`
                : reviews.notHelpfulCount,
            updatedAt: new Date(),
          })
          .where(eq(reviews.id, reviewId))
      })
    } else if (existingVote.vote !== voteValue) {
      await drizzleDb.transaction(async (tx) => {
        await tx
          .update(reviewVotes)
          .set({ vote: voteValue, updatedAt: new Date() })
          .where(eq(reviewVotes.id, existingVote.id))

        await tx
          .update(reviews)
          .set({
            helpfulCount: sql`${reviews.helpfulCount} + ${
              voteValue === 1 ? 1 : -1
            }`,
            notHelpfulCount: sql`${reviews.notHelpfulCount} + ${
              voteValue === -1 ? 1 : -1
            }`,
            updatedAt: new Date(),
          })
          .where(eq(reviews.id, reviewId))
      })
    }

    const updatedReview = await drizzleDb.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
      columns: { helpfulCount: true, notHelpfulCount: true },
    })

    return apiSuccess(
      {
        reviewId,
        vote,
        helpfulCount: updatedReview?.helpfulCount ?? review.helpfulCount,
        notHelpfulCount:
          updatedReview?.notHelpfulCount ?? review.notHelpfulCount,
      },
      200
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export const POST = withLogging(handlePost)
