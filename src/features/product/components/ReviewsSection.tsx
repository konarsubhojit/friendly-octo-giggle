'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { StarRating } from '@/components/ui/StarRating'
import { ReviewForm } from '@/features/product/components/ReviewForm'
import { Card } from '@/components/ui/Card'
import Image from 'next/image'
import { GradientButton } from '@/components/ui/GradientButton'

interface ReviewUser {
  name: string | null
  image: string | null
}

interface Review {
  id: string
  rating: number
  comment: string
  isAnonymous: boolean
  isVerifiedBuyer: boolean
  helpfulCount: number
  notHelpfulCount: number
  createdAt: string
  user: ReviewUser | null
  isOwnReview?: boolean
  userVote?: 'up' | 'down' | null
}

interface ReviewSummary {
  totalReviews: number
  averageRating: number
  ratingBreakdown: Array<{ rating: number; count: number }>
}

interface ReviewsSectionProps {
  readonly productId: string
}

type SortValue = 'recent' | 'top' | 'helpful'

const SORT_OPTIONS: Array<{ label: string; value: SortValue }> = [
  { label: 'Most recent', value: 'recent' },
  { label: 'Top rated', value: 'top' },
  { label: 'Most helpful', value: 'helpful' },
]

const ReviewCard = ({
  review,
  onVote,
  onEdit,
  onDelete,
  isUpdating,
}: {
  readonly review: Review
  readonly onVote: (reviewId: string, vote: 'up' | 'down') => void
  readonly onEdit: (review: Review) => void
  readonly onDelete: (reviewId: string) => void
  readonly isUpdating: boolean
}) => {
  const displayName =
    review.isAnonymous || !review.user
      ? 'Anonymous'
      : (review.user.name ?? 'Customer')

  return (
    <div className="border-b border-[var(--border-warm)] py-5 last:border-0">
      <div className="flex gap-4">
        <div className="shrink-0">
          {!review.isAnonymous && review.user?.image ? (
            <Image
              src={review.user.image}
              alt={displayName}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-blush)]">
              <span
                className="text-sm font-bold text-[var(--accent-rose)]"
                aria-hidden="true"
              >
                {displayName[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {displayName}
            </span>
            <StarRating rating={review.rating} size="sm" />
            {review.isVerifiedBuyer && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Verified buyer
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {review.comment}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>
              {new Date(review.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={() => onVote(review.id, 'up')}
              disabled={isUpdating}
              aria-pressed={review.userVote === 'up'}
              className={`rounded-full border px-2 py-1 transition ${
                review.userVote === 'up'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-[var(--border-warm)] hover:border-emerald-400'
              }`}
            >
              👍 {review.helpfulCount}
            </button>
            <button
              type="button"
              onClick={() => onVote(review.id, 'down')}
              disabled={isUpdating}
              aria-pressed={review.userVote === 'down'}
              className={`rounded-full border px-2 py-1 transition ${
                review.userVote === 'down'
                  ? 'border-rose-500 bg-rose-50 text-rose-700'
                  : 'border-[var(--border-warm)] hover:border-rose-400'
              }`}
            >
              👎 {review.notHelpfulCount}
            </button>
            {review.isOwnReview && (
              <>
                <button
                  type="button"
                  className="rounded-full border border-[var(--border-warm)] px-2 py-1 hover:border-[var(--accent-rose)]"
                  onClick={() => onEdit(review)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-full border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-50"
                  onClick={() => onDelete(review.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const RatingSummary = ({ summary }: { readonly summary: ReviewSummary }) => {
  if (summary.totalReviews === 0) return null

  return (
    <div className="mb-6 flex items-start gap-6 border-b border-[var(--border-warm)] pb-6">
      <div className="shrink-0 text-center">
        <p className="text-5xl font-bold text-[var(--foreground)]">
          {summary.averageRating.toFixed(1)}
        </p>
        <StarRating rating={Math.round(summary.averageRating)} size="md" />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {summary.totalReviews}{' '}
          {summary.totalReviews === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      <div className="flex-1 space-y-1.5">
        {summary.ratingBreakdown.map(({ rating, count }) => (
          <div key={rating} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-xs text-[var(--text-muted)]">
              {rating}★
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border-warm)]">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{
                  width: summary.totalReviews
                    ? `${(count / summary.totalReviews) * 100}%`
                    : '0%',
                }}
              />
            </div>
            <span className="w-4 shrink-0 text-right text-xs text-[var(--text-muted)]">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const REVIEW_SKELETON_KEYS = ['skel-a', 'skel-b', 'skel-c'] as const

const ReviewsSkeleton = () => (
  <div className="space-y-4" aria-label="Loading reviews">
    {REVIEW_SKELETON_KEYS.map((key) => (
      <div
        key={key}
        className="h-24 animate-pulse rounded-xl bg-[var(--border-warm)]/40"
      />
    ))}
  </div>
)

interface ReviewsContentProps {
  readonly loading: boolean
  readonly reviews: Review[]
  readonly visibleReviews: Review[]
  readonly summary: ReviewSummary
  readonly visibleCount: number
  readonly busyReviewId: string | null
  readonly onLoadMore: () => void
  readonly onVote: (reviewId: string, vote: 'up' | 'down') => void
  readonly onEdit: (review: Review) => void
  readonly onDelete: (reviewId: string) => void
}

const ReviewsContent = ({
  loading,
  reviews,
  visibleReviews,
  summary,
  visibleCount,
  busyReviewId,
  onLoadMore,
  onVote,
  onEdit,
  onDelete,
}: ReviewsContentProps) => {
  if (loading) return <ReviewsSkeleton />

  if (reviews.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          No reviews yet. Be the first to share your thoughts!
        </p>
      </div>
    )
  }

  return (
    <>
      <RatingSummary summary={summary} />
      <div>
        {visibleReviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onVote={onVote}
            onEdit={onEdit}
            onDelete={onDelete}
            isUpdating={busyReviewId === review.id}
          />
        ))}
      </div>
      {visibleCount < reviews.length && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-full border border-[var(--border-warm)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent-rose)] hover:text-[var(--foreground)]"
          >
            Load more reviews
          </button>
        </div>
      )}
    </>
  )
}

export const ReviewsSection = ({ productId }: ReviewsSectionProps) => {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewSummary>({
    totalReviews: 0,
    averageRating: 0,
    ratingBreakdown: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
  })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sortBy, setSortBy] = useState<SortValue>('recent')
  const [ratingFilter, setRatingFilter] = useState<string>('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(5)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [editRating, setEditRating] = useState(0)
  const [editComment, setEditComment] = useState('')
  const [editAnonymous, setEditAnonymous] = useState(false)
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        productId,
        sort: sortBy,
      })
      if (ratingFilter) params.set('rating', ratingFilter)
      if (verifiedOnly) params.set('verified', 'true')

      const res = await fetch(`/api/reviews?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to load reviews')
      }
      const data = await res.json()
      const nextReviews: Review[] = data.data?.reviews ?? data.reviews ?? []
      setReviews(nextReviews)
      setSummary(
        data.data?.summary ?? {
          totalReviews: nextReviews.length,
          averageRating:
            nextReviews.length > 0
              ? nextReviews.reduce((sum, review) => sum + review.rating, 0) /
                nextReviews.length
              : 0,
          ratingBreakdown: [5, 4, 3, 2, 1].map((rating) => ({
            rating,
            count: nextReviews.filter((review) => review.rating === rating)
              .length,
          })),
        }
      )
      setVisibleCount(5)
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Could not load reviews right now.'
      )
    } finally {
      setLoading(false)
    }
  }, [productId, ratingFilter, sortBy, verifiedOnly])

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      void fetchReviews()
    }, 0)

    return () => {
      globalThis.clearTimeout(timer)
    }
  }, [fetchReviews])

  const handleReviewSuccess = () => {
    setShowForm(false)
    void fetchReviews()
  }

  const handleVote = async (reviewId: string, vote: 'up' | 'down') => {
    if (!session?.user) {
      setError('Please sign in to vote on reviews.')
      return
    }

    setBusyReviewId(reviewId)
    setError(null)
    try {
      const response = await fetch('/api/reviews/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, vote }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to submit your vote')
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                userVote: vote,
                helpfulCount: data.data?.helpfulCount ?? review.helpfulCount,
                notHelpfulCount:
                  data.data?.notHelpfulCount ?? review.notHelpfulCount,
              }
            : review
        )
      )
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : 'Vote failed')
    } finally {
      setBusyReviewId(null)
    }
  }

  const startEdit = (review: Review) => {
    setEditingReview(review)
    setEditRating(review.rating)
    setEditComment(review.comment)
    setEditAnonymous(review.isAnonymous)
  }

  const saveEdit = async () => {
    if (!editingReview) return
    if (editRating < 1 || editRating > 5) {
      setError('Please select a star rating.')
      return
    }
    if (editComment.trim().length < 10) {
      setError('Review must be at least 10 characters.')
      return
    }

    setBusyReviewId(editingReview.id)
    setError(null)
    try {
      const response = await fetch(`/api/reviews?id=${editingReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: editRating,
          comment: editComment.trim(),
          isAnonymous: editAnonymous,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Could not update review')
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === editingReview.id
            ? { ...review, ...data.data.review }
            : review
        )
      )
      setEditingReview(null)
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Update failed')
    } finally {
      setBusyReviewId(null)
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!globalThis.confirm('Delete this review?')) return

    setBusyReviewId(reviewId)
    setError(null)
    try {
      const response = await fetch(`/api/reviews?id=${reviewId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Could not delete review')
      }
      setReviews((current) =>
        current.filter((review) => review.id !== reviewId)
      )
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Delete failed'
      )
    } finally {
      setBusyReviewId(null)
    }
  }

  const visibleReviews = reviews.slice(0, visibleCount)

  return (
    <section aria-labelledby="reviews-heading" className="mt-12">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="reviews-heading"
            className="text-xl font-bold text-[var(--foreground)]"
          >
            Customer Reviews
          </h2>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-sm font-medium text-[var(--accent-rose)] transition-colors hover:text-[var(--accent-pink)] focus-warm"
            >
              Write a review
            </button>
          )}
        </div>

        {showForm && (
          <div className="mb-8 border-b border-[var(--border-warm)] pb-8">
            <h3 className="mb-4 text-base font-semibold text-[var(--foreground)]">
              Share Your Experience
            </h3>
            <ReviewForm productId={productId} onSuccess={handleReviewSuccess} />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="mt-3 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-[var(--text-secondary)]">
            <span>Sort</span>
            <select
              className="ml-2 rounded-lg border border-[var(--border-warm)] bg-[var(--surface)] px-2 py-1 text-sm"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortValue)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">
            <span>Rating</span>
            <select
              className="ml-2 rounded-lg border border-[var(--border-warm)] bg-[var(--surface)] px-2 py-1 text-sm"
              value={ratingFilter}
              onChange={(event) => setRatingFilter(event.target.value)}
            >
              <option value="">All</option>
              <option value="5">5 ★</option>
              <option value="4">4 ★</option>
              <option value="3">3 ★</option>
              <option value="2">2 ★</option>
              <option value="1">1 ★</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => setVerifiedOnly(event.target.checked)}
            />
            <span>Verified buyers only</span>
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}

        {editingReview && (
          <div className="mb-5 rounded-xl border border-[var(--border-warm)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">
              Edit your review
            </p>
            <StarRating
              rating={editRating}
              interactive
              size="md"
              onChange={setEditRating}
              label="Edit rating"
            />
            <textarea
              className="mt-3 w-full rounded-lg border border-[var(--border-warm)] bg-[var(--surface)] px-3 py-2 text-sm"
              rows={4}
              value={editComment}
              onChange={(event) => setEditComment(event.target.value)}
            />
            <label className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={editAnonymous}
                onChange={(event) => setEditAnonymous(event.target.checked)}
              />
              <span>Submit anonymously</span>
            </label>
            <div className="mt-3 flex gap-2">
              <GradientButton
                type="button"
                disabled={busyReviewId === editingReview.id}
                onClick={saveEdit}
              >
                Save
              </GradientButton>
              <button
                type="button"
                className="rounded-lg border border-[var(--border-warm)] px-3 py-2 text-sm"
                onClick={() => setEditingReview(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <ReviewsContent
          loading={loading}
          reviews={reviews}
          visibleReviews={visibleReviews}
          summary={summary}
          visibleCount={visibleCount}
          busyReviewId={busyReviewId}
          onLoadMore={() => setVisibleCount((count) => count + 5)}
          onVote={handleVote}
          onEdit={startEdit}
          onDelete={handleDelete}
        />
      </Card>
    </section>
  )
}
