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
})
