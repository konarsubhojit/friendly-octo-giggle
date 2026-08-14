'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DataTableColumn } from 'zenput'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import { AdminDataView } from '@/features/admin/components/AdminDataView'
import type {
  BulkResult,
  BulkSelection,
} from '@/features/admin/components/resource-list-definition'
import {
  createReviewsDefinition,
  type ReviewRow as ReviewDefinitionRow,
} from '@/features/admin/resources/reviews'
import type { AdminPermission } from '@/lib/constants/roles'

type HiddenFilter = 'all' | 'hidden' | 'visible'

interface ReviewProduct {
  readonly id: string
  readonly name: string
  readonly image: string
}

interface ReviewUser {
  readonly id: string
  readonly name: string | null
  readonly email: string
  readonly image: string | null
}

interface AdminReview {
  readonly id: string
  readonly productId: string
  readonly rating: number
  readonly comment: string
  readonly isAnonymous: boolean
  readonly isVerifiedBuyer: boolean
  readonly isFeatured: boolean
  readonly isHidden: boolean
  readonly helpfulCount: number
  readonly notHelpfulCount: number
  readonly createdAt: string
  readonly product: ReviewProduct | null
  readonly user: ReviewUser | null
}

interface ReviewsManagementClientProps {
  readonly permissions: readonly AdminPermission[]
}

interface ReviewActionButtonsProps {
  readonly review: AdminReview
  readonly disabled: boolean
  readonly canModerate: boolean
  readonly onModerate: (
    reviewId: string,
    updates: { isFeatured?: boolean; isHidden?: boolean }
  ) => void
  readonly onRemove: (reviewId: string) => void
  readonly className?: string
}

interface ReviewCardProps {
  readonly review: AdminReview
  readonly pendingActionId: string | null
  readonly canModerate: boolean
  readonly onModerate: (
    reviewId: string,
    updates: { isFeatured?: boolean; isHidden?: boolean }
  ) => void
  readonly onRemove: (reviewId: string) => void
}

const RATING_FILTERS = [
  { label: 'All', value: '' },
  { label: '5 ★', value: '5' },
  { label: '4 ★', value: '4' },
  { label: '3 ★', value: '3' },
  { label: '2 ★', value: '2' },
  { label: '1 ★', value: '1' },
] as const

const getReviewerLabel = (review: AdminReview) => {
  if (review.isAnonymous || !review.user) {
    return 'Anonymous'
  }

  return review.user.name ?? review.user.email
}

const getStatusLabel = (review: AdminReview) => {
  if (review.isHidden && review.isFeatured) {
    return 'Hidden • Featured'
  }

  if (review.isHidden) {
    return 'Hidden'
  }

  if (review.isFeatured) {
    return 'Featured'
  }

  return 'Visible'
}

function ReviewMeta({ review }: Readonly<{ review: AdminReview }>) {
  const displayName = getReviewerLabel(review)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
      <span>
        By:{' '}
        <strong className="text-slate-700 dark:text-slate-200">
          {displayName}
        </strong>
      </span>
      {!review.isAnonymous && review.user?.email ? <span>{review.user.email}</span> : null}
      <span>
        {new Date(review.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    </div>
  )
}

function ReviewActionButtons({
  review,
  disabled,
  canModerate,
  onModerate,
  onRemove,
  className,
}: ReviewActionButtonsProps) {
  if (!canModerate) {
    return null
  }

  return (
    <div className={className ?? 'flex flex-wrap gap-2'}>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onModerate(review.id, { isFeatured: !review.isFeatured })
        }
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-slate-50"
      >
        {review.isFeatured ? 'Unfeature' : 'Feature'}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onModerate(review.id, { isHidden: !review.isHidden })}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-slate-50"
      >
        {review.isHidden ? 'Unhide' : 'Hide'}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRemove(review.id)}
        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/40"
      >
        Remove
      </button>
    </div>
  )
}

function ReviewCard({
  review,
  pendingActionId,
  canModerate,
  onModerate,
  onRemove,
}: ReviewCardProps) {
  return (
    <div className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-950/40">
      <div className="flex items-start gap-4">
        {review.product ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Image
              src={review.product.image}
              alt={review.product.name}
              fill
              loading="lazy"
              sizes="56px"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StarRating rating={review.rating} size="sm" />
            {review.product ? (
              <span className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                {review.product.name}
              </span>
            ) : (
              <span className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
                Product unavailable
              </span>
            )}
            {review.isAnonymous ? (
              <Badge variant="neutral" size="sm">
                Anonymous
              </Badge>
            ) : null}
            {review.isVerifiedBuyer ? (
              <Badge variant="success" size="sm">
                Verified buyer
              </Badge>
            ) : null}
            {review.isFeatured ? (
              <Badge variant="info" size="sm">
                Featured
              </Badge>
            ) : null}
            {review.isHidden ? (
              <Badge variant="warning" size="sm">
                Hidden
              </Badge>
            ) : null}
          </div>
          <p className="mb-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {review.comment}
          </p>
          <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Helpful: {review.helpfulCount} · Not helpful: {review.notHelpfulCount}
          </div>
          <ReviewMeta review={review} />

          <ReviewActionButtons
            review={review}
            disabled={pendingActionId === review.id}
            canModerate={canModerate}
            onModerate={onModerate}
            onRemove={onRemove}
            className="mt-3 flex flex-wrap gap-2"
          />
        </div>
      </div>
    </div>
  )
}

function ReviewsFilters({
  search,
  onSearchChange,
  ratingFilter,
  onRatingChange,
  hiddenFilter,
  onHiddenFilterChange,
  verifiedOnly,
  onVerifiedChange,
}: {
  readonly search: string
  readonly onSearchChange: (value: string) => void
  readonly ratingFilter: string
  readonly onRatingChange: (value: string) => void
  readonly hiddenFilter: HiddenFilter
  readonly onHiddenFilterChange: (value: HiddenFilter) => void
  readonly verifiedOnly: boolean
  readonly onVerifiedChange: (value: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-2xl flex-1">
        <svg
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="search"
          placeholder="Search by product, user, or comment…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-4 text-sm text-slate-950 shadow-inner shadow-white/40 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-50 dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-slate-950 dark:focus:ring-sky-950"
          aria-label="Search reviews"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {RATING_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => onRatingChange(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
              ratingFilter === value
                ? 'bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50'
            }`}
            aria-pressed={ratingFilter === value}
          >
            {label}
          </button>
        ))}
        <select
          value={hiddenFilter}
          onChange={(event) =>
            onHiddenFilterChange(event.target.value as HiddenFilter)
          }
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          aria-label="Visibility filter"
        >
          <option value="all">All visibility</option>
          <option value="visible">Visible only</option>
          <option value="hidden">Hidden only</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => onVerifiedChange(event.target.checked)}
          />
          <span>Verified only</span>
        </label>
      </div>
    </div>
  )
}

export default function ReviewsManagementClient({
  permissions,
}: ReviewsManagementClientProps) {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [hiddenFilter, setHiddenFilter] = useState<HiddenFilter>('all')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [total, setTotal] = useState(0)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const canModerate = permissions.includes('reviews:moderate')

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (ratingFilter) params.set('rating', ratingFilter)
      if (hiddenFilter === 'hidden') params.set('hidden', 'true')
      if (hiddenFilter === 'visible') params.set('hidden', 'false')
      if (verifiedOnly) params.set('verified', 'true')

      const res = await fetch(`/api/admin/reviews?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load reviews')
      }

      const data = await res.json()
      const allReviews: AdminReview[] = data.data?.reviews ?? data.reviews ?? []
      setReviews(allReviews)
      setTotal(data.data?.total ?? allReviews.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [ratingFilter, hiddenFilter, verifiedOnly])

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      void fetchReviews()
    }, 0)

    return () => {
      globalThis.clearTimeout(timer)
    }
  }, [fetchReviews])

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return reviews
    }

    return reviews.filter((review) => {
      const productName = review.product?.name?.toLowerCase() ?? ''
      const userName = review.user?.name?.toLowerCase() ?? ''
      const userEmail = review.user?.email?.toLowerCase() ?? ''
      return (
        productName.includes(query) ||
        userName.includes(query) ||
        userEmail.includes(query) ||
        review.comment.toLowerCase().includes(query)
      )
    })
  }, [reviews, search])

  const averageRating =
    filteredReviews.length > 0
      ? filteredReviews.reduce((sum, review) => sum + review.rating, 0) /
        filteredReviews.length
      : 0

  const removeReviewById = useCallback((reviewId: string) => {
    setReviews((current) => current.filter((review) => review.id !== reviewId))
    setTotal((current) => Math.max(0, current - 1))
  }, [])

  const moderateReview = useCallback(
    async (
      reviewId: string,
      updates: { isFeatured?: boolean; isHidden?: boolean }
    ) => {
      setPendingActionId(reviewId)
      setError(null)
      try {
        const res = await fetch(`/api/admin/reviews/${reviewId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update review')
        }
        setReviews((current) =>
          current.map((review) =>
            review.id === reviewId
              ? { ...review, ...(data.data?.review ?? {}) }
              : review
          )
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setPendingActionId(null)
      }
    },
    []
  )

  const deleteReview = useCallback(async (reviewId: string) => {
    const res = await fetch(`/api/admin/reviews/${reviewId}`, {
      method: 'DELETE',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'Failed to remove review')
    }
    return data
  }, [])

  const removeReview = useCallback(
    async (reviewId: string) => {
      if (!globalThis.confirm('Remove this review permanently?')) {
        return
      }

      setPendingActionId(reviewId)
      setError(null)
      try {
        await deleteReview(reviewId)
        removeReviewById(reviewId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setPendingActionId(null)
      }
    },
    [deleteReview, removeReviewById]
  )

  const bulkRemoveReviews = useCallback(
    async (selection: BulkSelection): Promise<BulkResult> => {
      setError(null)

      if (selection.scope === 'entire_filtered_result') {
        const unsupportedIds = filteredReviews.map((review) => review.id)
        return {
          succeeded: [],
          failed: unsupportedIds.map((rowId) => ({
            rowId,
            reason:
              'Bulk review removal only supports selected rows on the loaded page.',
          })),
        }
      }

      const outcomes = await Promise.all(
        selection.rowIds.map(async (rowId) => {
          try {
            await deleteReview(String(rowId))
            return { rowId, ok: true as const }
          } catch (err) {
            return {
              rowId,
              ok: false as const,
              reason:
                err instanceof Error ? err.message : 'Failed to remove review',
            }
          }
        })
      )

      const succeeded = outcomes
        .filter((outcome) => outcome.ok)
        .map((outcome) => outcome.rowId)
      const failed = outcomes
        .filter((outcome) => !outcome.ok)
        .map((outcome) => ({
          rowId: outcome.rowId,
          reason: outcome.reason,
        }))

      if (succeeded.length > 0) {
        const succeededSet = new Set(succeeded.map(String))
        setReviews((current) =>
          current.filter((review) => !succeededSet.has(review.id))
        )
        setTotal((current) => Math.max(0, current - succeeded.length))
      }

      if (failed.length > 0) {
        setError(
          failed.length === selection.rowIds.length
            ? 'Failed to remove the selected reviews.'
            : 'Some selected reviews could not be removed.'
        )
      }

      return { succeeded, failed }
    },
    [deleteReview, filteredReviews]
  )

  const reviewsDefinition = useMemo(
    () =>
      createReviewsDefinition(permissions, {
        // AdminDataView consumes columns and bulk actions today; row actions
        // from the definition are mirrored via the appended desktop actions
        // column and the rich mobile card buttons below.
        onFeature: (row) => {
          void moderateReview(row.id, {
            isFeatured: !reviews.find((review) => review.id === row.id)?.isFeatured,
          })
        },
        onHide: (row) => {
          void moderateReview(row.id, {
            isHidden: !reviews.find((review) => review.id === row.id)?.isHidden,
          })
        },
        onRemove: (row) => {
          void removeReview(row.id)
        },
        onBulkRemove: bulkRemoveReviews,
      }),
    [permissions, moderateReview, removeReview, bulkRemoveReviews, reviews]
  )

  const reviewRows: ReviewDefinitionRow[] = useMemo(
    () =>
      filteredReviews.map((review) => ({
        id: review.id,
        product: review.product?.name ?? 'Product unavailable',
        reviewer: getReviewerLabel(review),
        rating: `${review.rating} ★`,
        comment: review.comment,
        status: getStatusLabel(review),
        createdAt: new Date(review.createdAt).toLocaleDateString('en-GB'),
      })),
    [filteredReviews]
  )

  const reviewColumns: DataTableColumn<ReviewDefinitionRow>[] = useMemo(
    () => [
      ...reviewsDefinition.columns,
      {
        key: 'actions',
        header: 'Actions',
        sticky: 'right',
        render: (_value, row) => {
          const review = filteredReviews.find((candidate) => candidate.id === row.id)
          if (!review || !canModerate) {
            return null
          }

          return (
            <ReviewActionButtons
              review={review}
              disabled={pendingActionId === review.id}
              canModerate={canModerate}
              onModerate={moderateReview}
              onRemove={removeReview}
              className="flex flex-wrap justify-end gap-2"
            />
          )
        },
      },
    ],
    [
      reviewsDefinition.columns,
      filteredReviews,
      canModerate,
      pendingActionId,
      moderateReview,
      removeReview,
    ]
  )

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; value: string }> = []

    if (search.trim()) {
      chips.push({ key: 'search', label: 'Search', value: search.trim() })
    }
    if (ratingFilter) {
      chips.push({ key: 'rating', label: 'Rating', value: `${ratingFilter} ★` })
    }
    if (hiddenFilter !== 'all') {
      chips.push({
        key: 'hidden',
        label: 'Visibility',
        value: hiddenFilter === 'hidden' ? 'Hidden' : 'Visible',
      })
    }
    if (verifiedOnly) {
      chips.push({ key: 'verified', label: 'Buyer', value: 'Verified only' })
    }

    return chips
  }, [search, ratingFilter, hiddenFilter, verifiedOnly])

  const hasActiveFilters =
    search.trim().length > 0 ||
    ratingFilter.length > 0 ||
    hiddenFilter !== 'all' ||
    verifiedOnly

  const listState = error
    ? { status: 'error' as const, message: error, onRetry: fetchReviews }
    : filteredReviews.length === 0 && hasActiveFilters
      ? {
          status: 'filtered-empty' as const,
          message: reviewsDefinition.filteredEmptyMessage,
        }
      : reviews.length === 0 && !loading
        ? {
            status: 'empty' as const,
            message: reviewsDefinition.emptyMessage,
          }
        : undefined

  const handleRemoveFilter = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'rating') setRatingFilter('')
    if (key === 'hidden') setHiddenFilter('all')
    if (key === 'verified') setVerifiedOnly(false)
  }

  const handleClearFilters = () => {
    setSearch('')
    setRatingFilter('')
    setHiddenFilter('all')
    setVerifiedOnly(false)
  }

  return (
    <AdminPageShell
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Reviews' }]}
      eyebrow="Customer feedback"
      title="Review Management"
      description="View, search, and moderate customer product reviews."
      actions={
        <button
          type="button"
          onClick={fetchReviews}
          disabled={loading}
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
        >
          Refresh
        </button>
      }
      metrics={[
        {
          label: 'Total reviews',
          value: String(total),
          hint: 'Total reviews submitted.',
          tone: 'sky',
        },
        {
          label: 'Average rating',
          value: averageRating > 0 ? `${averageRating.toFixed(1)} / 5` : 'No data',
          hint: 'Average across visible results.',
          tone: 'amber',
        },
        {
          label: 'Visible results',
          value: String(filteredReviews.length),
          hint: 'Matching current filters.',
          tone: 'emerald',
        },
      ]}
    >
      {error ? (
        <AlertBanner message={error} variant="error" className="mb-0" />
      ) : null}

      <AdminPanel title="Filter" description="">
        <ReviewsFilters
          search={search}
          onSearchChange={setSearch}
          ratingFilter={ratingFilter}
          onRatingChange={setRatingFilter}
          hiddenFilter={hiddenFilter}
          onHiddenFilterChange={setHiddenFilter}
          verifiedOnly={verifiedOnly}
          onVerifiedChange={setVerifiedOnly}
        />
      </AdminPanel>

      <AdminPanel title="Reviews" description="">
        <AdminDataView
          ariaLabel="Reviews"
          definition={{ ...reviewsDefinition, columns: reviewColumns }}
          data={reviewRows}
          rowKey={(row) => row.id}
          loading={loading}
          skeletonRowCount={5}
          emptyMessage={reviewsDefinition.emptyMessage}
          listState={listState}
          filterSnapshot={{
            search,
            rating: ratingFilter,
            hidden: hiddenFilter,
            verified: verifiedOnly,
          }}
          filterChips={filterChips}
          onRemoveFilter={handleRemoveFilter}
          onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          renderMobileCard={(row) => {
            const review = filteredReviews.find((candidate) => candidate.id === row.id)
            if (!review) {
              return null
            }

            return (
              <ReviewCard
                review={review}
                pendingActionId={pendingActionId}
                canModerate={canModerate}
                onModerate={moderateReview}
                onRemove={removeReview}
              />
            )
          }}
          csvExport={{
            exportUrl: '/api/admin/export/reviews',
            filenameFallback: 'reviews.csv',
          }}
        />
      </AdminPanel>
    </AdminPageShell>
  )
}
