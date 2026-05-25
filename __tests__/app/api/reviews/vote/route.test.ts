import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockReviewsFindFirst,
  mockReviewVotesFindFirst,
  mockTransaction,
  mockTxInsert,
  mockTxUpdate,
} = vi.hoisted(() => {
  const mockTxInsertValues = vi.fn()
  const mockTxInsert = vi.fn(() => ({ values: mockTxInsertValues }))
  const mockTxUpdateWhere = vi.fn()
  const mockTxUpdateSet = vi.fn(() => ({ where: mockTxUpdateWhere }))
  const mockTxUpdate = vi.fn(() => ({ set: mockTxUpdateSet }))
  const tx = { insert: mockTxInsert, update: mockTxUpdate }
  const mockTransaction = vi.fn(async (callback) => await callback(tx))

  return {
    mockReviewsFindFirst: vi.fn(),
    mockReviewVotesFindFirst: vi.fn(),
    mockTransaction,
    mockTxInsert,
    mockTxUpdate,
    mockTxUpdateSet,
    mockTxUpdateWhere,
  }
})

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      reviews: { findFirst: mockReviewsFindFirst },
      reviewVotes: { findFirst: mockReviewVotesFindFirst },
    },
    transaction: mockTransaction,
  },
}))
vi.mock('@/lib/schema', () => ({
  reviews: {
    id: 'id',
    helpfulCount: 'helpfulCount',
    notHelpfulCount: 'notHelpfulCount',
  },
  reviewVotes: {
    id: 'id',
    reviewId: 'reviewId',
    userId: 'userId',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn((...args) => args),
  sql: vi.fn((strings: TemplateStringsArray) => strings.join('')),
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

import { POST } from '@/app/api/reviews/vote/route'
import { auth } from '@/lib/auth'

const mockAuth = vi.mocked(auth)

const makePostRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/reviews/vote', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('POST /api/reviews/vote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null as never)

    const response = await POST(
      makePostRequest({ reviewId: 'abc1234', vote: 'up' })
    )
    expect(response.status).toBe(401)
  })

  it('creates vote and returns updated counts', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', email: 'u@test.com' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never)

    mockReviewsFindFirst
      .mockResolvedValueOnce({
        id: 'abc1234',
        isHidden: false,
        helpfulCount: 1,
        notHelpfulCount: 0,
      })
      .mockResolvedValueOnce({
        helpfulCount: 2,
        notHelpfulCount: 0,
      })
    mockReviewVotesFindFirst.mockResolvedValue(null)

    const response = await POST(
      makePostRequest({ reviewId: 'abc1234', vote: 'up' })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.helpfulCount).toBe(2)
    expect(mockTransaction).toHaveBeenCalled()
    expect(mockTxInsert).toHaveBeenCalled()
    expect(mockTxUpdate).toHaveBeenCalled()
  })
})
