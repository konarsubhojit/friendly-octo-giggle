import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockReviewsFindMany,
  mockReviewsFindFirst,
  mockReviewVotesFindMany,
  mockInsert,
  mockInsertReturning,
  mockSelect,
  mockSelectLimit,
  mockUpdate,
  mockDelete,
  mockDeleteWhere,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn()
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }))
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }))

  const mockSelectLimit = vi.fn()
  const mockSelectOrderBy = vi.fn(() => ({ limit: mockSelectLimit }))
  const mockSelectWhere = vi.fn(() => ({ orderBy: mockSelectOrderBy }))
  const mockSelectInnerJoin = vi.fn(() => ({ where: mockSelectWhere }))
  const mockSelectFrom = vi.fn(() => ({ innerJoin: mockSelectInnerJoin }))
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }))

  const mockUpdateReturning = vi.fn()
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }))
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }))

  const mockDeleteWhere = vi.fn()
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }))

  return {
    mockReviewsFindMany: vi.fn(),
    mockReviewsFindFirst: vi.fn(),
    mockReviewVotesFindMany: vi.fn(),
    mockInsert,
    mockInsertReturning,
    mockSelect,
    mockSelectFrom,
    mockSelectInnerJoin,
    mockSelectWhere,
    mockSelectOrderBy,
    mockSelectLimit,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockUpdateReturning,
    mockDelete,
    mockDeleteWhere,
  }
})

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      reviews: {
        findMany: mockReviewsFindMany,
        findFirst: mockReviewsFindFirst,
      },
      reviewVotes: { findMany: mockReviewVotesFindMany },
    },
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  },
}))
vi.mock('@/lib/schema', () => ({
  reviews: {
    id: 'id',
    productId: 'productId',
    userId: 'userId',
    createdAt: 'createdAt',
    isHidden: 'isHidden',
    isFeatured: 'isFeatured',
    rating: 'rating',
    helpfulCount: 'helpfulCount',
    notHelpfulCount: 'notHelpfulCount',
  },
  reviewVotes: {
    userId: 'voteUserId',
    reviewId: 'reviewId',
  },
  orderItems: {
    orderId: 'orderId',
    productId: 'productId',
  },
  orders: {
    id: 'id',
    userId: 'orderUserId',
    createdAt: 'createdAt',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn((...args) => args),
  inArray: vi.fn(),
  asc: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/api-middleware', () => ({
  withLogging: vi.fn((handler) => handler),
}))
vi.mock(
  '@/lib/validations',
  async () => await vi.importActual('@/lib/validations')
)
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { GET, POST, PATCH, DELETE } from '@/app/api/reviews/route'
import { auth } from '@/lib/auth'

const mockAuth = vi.mocked(auth)

const makeGetRequest = (params?: Record<string, string>) => {
  const url = new URL('http://localhost/api/reviews')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url)
}

const makeRequest = (
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
  params?: Record<string, string>
) => {
  const url = new URL('http://localhost/api/reviews')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('Reviews API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null as never)
  })

  describe('GET /api/reviews', () => {
    it('returns 400 when productId is missing', async () => {
      const response = await GET(makeGetRequest())
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error).toContain('productId')
    })

    it('returns reviews with summary, ownership and votes', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1', email: 'u@test.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindMany.mockResolvedValue([
        {
          id: 'rev1',
          userId: 'user1',
          rating: 5,
          helpfulCount: 2,
          notHelpfulCount: 0,
          comment: 'Great product!',
          isAnonymous: false,
          isVerifiedBuyer: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          user: { name: 'Jane', image: null },
        },
      ])
      mockReviewVotesFindMany.mockResolvedValue([{ reviewId: 'rev1', vote: 1 }])

      const response = await GET(
        makeGetRequest({ productId: 'prod001', sort: 'helpful' })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.reviews[0].isOwnReview).toBe(true)
      expect(data.data.reviews[0].userVote).toBe('up')
      expect(data.data.summary.totalReviews).toBe(1)
    })
  })

  describe('POST /api/reviews', () => {
    it('returns 401 when not authenticated', async () => {
      const response = await POST(
        makeRequest('POST', {
          productId: 'prod001',
          rating: 5,
          comment: 'Great product!',
        })
      )
      const data = await response.json()
      expect(response.status).toBe(401)
      expect(data.error).toContain('Authentication required')
    })

    it('creates review and marks verified buyer when purchase exists', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1', email: 'u@test.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindFirst.mockResolvedValue(null)
      mockSelectLimit.mockResolvedValue([{ orderId: 'ord1234567' }])
      mockInsertReturning.mockResolvedValue([
        {
          id: 'newrev1',
          productId: 'prod001',
          userId: 'user1',
          rating: 5,
          comment: 'Wonderful product, highly recommend',
          isAnonymous: false,
          isVerifiedBuyer: true,
          helpfulCount: 0,
          notHelpfulCount: 0,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ])

      const response = await POST(
        makeRequest('POST', {
          productId: 'prod001',
          rating: 5,
          comment: 'Wonderful product, highly recommend',
        })
      )
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.review.isVerifiedBuyer).toBe(true)
      expect(mockSelect).toHaveBeenCalled()
      expect(mockInsert).toHaveBeenCalled()
    })
  })

  describe('PATCH /api/reviews', () => {
    it('prevents editing another user review', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1', email: 'u@test.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindFirst.mockResolvedValue({ id: 'rev1', userId: 'user2' })

      const response = await PATCH(
        makeRequest(
          'PATCH',
          { rating: 4, comment: 'Updated review text with enough characters' },
          { id: 'rev1' }
        )
      )
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('own reviews')
    })
  })

  describe('DELETE /api/reviews', () => {
    it('deletes own review', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1', email: 'u@test.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindFirst.mockResolvedValue({ id: 'rev1', userId: 'user1' })
      mockDeleteWhere.mockResolvedValue(undefined)

      const response = await DELETE(
        makeRequest('DELETE', undefined, { id: 'rev1' })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.deleted).toBe(true)
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('GET /api/reviews (filters)', () => {
    const review = {
      id: 'rev1',
      userId: 'user2',
      rating: 3,
      helpfulCount: 0,
      notHelpfulCount: 0,
      comment: 'Fine',
      isAnonymous: false,
      isVerifiedBuyer: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      user: { name: 'Jane', image: null },
    }

    it('applies a valid rating filter and the verified-only flag', async () => {
      mockReviewsFindMany.mockResolvedValue([review])

      const response = await GET(
        makeGetRequest({ productId: 'p1', rating: '4', verified: 'true' })
      )

      expect(response.status).toBe(200)
      expect(mockReviewsFindMany).toHaveBeenCalled()
    })

    it.each([
      ['not-a-number', 'abc'],
      ['below the range', '0'],
      ['above the range', '9'],
    ])('ignores a rating filter that is %s', async (_label, rating) => {
      mockReviewsFindMany.mockResolvedValue([review])

      const response = await GET(makeGetRequest({ productId: 'p1', rating }))

      expect(response.status).toBe(200)
    })

    it('sorts by top rating', async () => {
      mockReviewsFindMany.mockResolvedValue([review])

      const response = await GET(
        makeGetRequest({ productId: 'p1', sort: 'top' })
      )

      expect(response.status).toBe(200)
    })

    it('hides the author of anonymous reviews and skips vote lookups', async () => {
      mockReviewsFindMany.mockResolvedValue([{ ...review, isAnonymous: true }])

      const response = await GET(makeGetRequest({ productId: 'p1' }))
      const data = await response.json()

      expect(data.data.reviews[0].user).toBeNull()
      expect(data.data.reviews[0].isOwnReview).toBe(false)
      expect(data.data.reviews[0].userVote).toBeNull()
      expect(mockReviewVotesFindMany).not.toHaveBeenCalled()
    })

    it('maps a downvote to "down" and an unknown vote to null', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindMany.mockResolvedValue([
        review,
        { ...review, id: 'rev2' },
        { ...review, id: 'rev3' },
      ])
      mockReviewVotesFindMany.mockResolvedValue([
        { reviewId: 'rev1', vote: -1 },
        { reviewId: 'rev2', vote: 0 },
      ])

      const response = await GET(makeGetRequest({ productId: 'p1' }))
      const data = await response.json()

      expect(data.data.reviews[0].userVote).toBe('down')
      expect(data.data.reviews[1].userVote).toBeNull()
      expect(data.data.reviews[2].userVote).toBeNull()
    })

    it('returns a zero average when there are no reviews', async () => {
      mockReviewsFindMany.mockResolvedValue([])

      const response = await GET(makeGetRequest({ productId: 'p1' }))
      const data = await response.json()

      expect(data.data.summary.averageRating).toBe(0)
      expect(data.data.summary.ratingBreakdown).toHaveLength(5)
    })

    it('handles database failures', async () => {
      mockReviewsFindMany.mockRejectedValue(new Error('db down'))

      const response = await GET(makeGetRequest({ productId: 'p1' }))

      expect(response.status).toBe(500)
    })
  })

  describe('POST /api/reviews (conflicts)', () => {
    const authed = () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
    }

    const body = {
      productId: 'prod001',
      rating: 5,
      comment: 'Wonderful product, highly recommend',
    }

    it('rejects a duplicate review', async () => {
      authed()
      mockReviewsFindFirst.mockResolvedValue({ id: 'rev1' })

      const response = await POST(makeRequest('POST', body))
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('already reviewed')
    })

    it('scopes the purchase lookup to a provided order id', async () => {
      authed()
      mockReviewsFindFirst.mockResolvedValue(null)
      mockSelectLimit.mockResolvedValue([])
      mockInsertReturning.mockResolvedValue([
        {
          id: 'newrev1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          isVerifiedBuyer: false,
        },
      ])

      const response = await POST(
        makeRequest('POST', { ...body, orderId: 'ORD1234567' })
      )
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.review.isVerifiedBuyer).toBe(false)
    })

    it.each([
      ['a pg unique code', Object.assign(new Error('dup'), { code: '23505' })],
      [
        'a named constraint',
        Object.assign(new Error('dup'), {
          constraint: 'reviews_userId_productId_key',
        }),
      ],
    ])('maps %s to a 409', async (_label, error) => {
      authed()
      mockReviewsFindFirst.mockResolvedValue(null)
      mockSelectLimit.mockRejectedValue(error)

      const response = await POST(makeRequest('POST', body))

      expect(response.status).toBe(409)
    })

    it('falls through to the generic error handler', async () => {
      authed()
      mockReviewsFindFirst.mockResolvedValue(null)
      mockSelectLimit.mockRejectedValue(new Error('db down'))

      const response = await POST(makeRequest('POST', body))

      expect(response.status).toBe(500)
    })
  })

  describe('PATCH /api/reviews (guards)', () => {
    it('returns 401 without a session', async () => {
      const response = await PATCH(
        makeRequest('PATCH', { rating: 4 }, { id: 'rev1' })
      )
      expect(response.status).toBe(401)
    })

    it('returns 400 without an id', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)

      const response = await PATCH(makeRequest('PATCH', { rating: 4 }))
      expect(response.status).toBe(400)
    })

    it('returns 404 when the review is missing', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindFirst.mockResolvedValue(null)

      const response = await PATCH(
        makeRequest('PATCH', { rating: 4 }, { id: 'rev1' })
      )
      expect(response.status).toBe(404)
    })

    it('updates an owned review', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindFirst.mockResolvedValue({ id: 'rev1', userId: 'user1' })
      mockUpdate.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [
              {
                id: 'rev1',
                rating: 4,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
              },
            ]),
          })),
        })),
      } as never)

      const response = await PATCH(
        makeRequest(
          'PATCH',
          { rating: 4, comment: 'Updated review text with enough characters' },
          { id: 'rev1' }
        )
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.review.rating).toBe(4)
    })
  })

  describe('DELETE /api/reviews (guards)', () => {
    it('returns 401 without a session', async () => {
      const response = await DELETE(
        makeRequest('DELETE', undefined, { id: 'rev1' })
      )
      expect(response.status).toBe(401)
    })

    it('returns 400 without an id', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)

      const response = await DELETE(makeRequest('DELETE'))
      expect(response.status).toBe(400)
    })

    it('returns 404 when the review is missing', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindFirst.mockResolvedValue(null)

      const response = await DELETE(
        makeRequest('DELETE', undefined, { id: 'rev1' })
      )
      expect(response.status).toBe(404)
    })

    it('returns 403 for another user review', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never)
      mockReviewsFindFirst.mockResolvedValue({ id: 'rev1', userId: 'user2' })

      const response = await DELETE(
        makeRequest('DELETE', undefined, { id: 'rev1' })
      )
      expect(response.status).toBe(403)
    })
  })
})
