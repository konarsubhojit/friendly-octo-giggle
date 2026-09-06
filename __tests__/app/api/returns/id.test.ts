import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockFindFirst } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindFirst: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: {
    query: {
      returnRequests: { findFirst: mockFindFirst },
    },
  },
}))

vi.mock('@/lib/schema', () => ({
  returnRequests: { id: 'id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

import { GET } from '@/app/api/returns/[id]/route'

const params = Promise.resolve({ id: 'ret0001' })

const getRequest = () =>
  new NextRequest('https://localhost/api/returns/ret0001')

const returnRequest = {
  id: 'ret0001',
  orderId: 'ORD1234567',
  userId: 'user-1',
  status: 'REQUESTED',
  reason: 'DAMAGED',
  customerNote: null,
  decisionReason: null,
  refundAmount: 1000,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  decidedAt: null,
  receivedAt: null,
  items: [],
  evidence: [],
  refund: null,
}

describe('GET /api/returns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when the caller is not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await GET(getRequest(), { params })

    expect(response.status).toBe(401)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when the return does not exist', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindFirst.mockResolvedValue(undefined)

    const response = await GET(getRequest(), { params })

    expect(response.status).toBe(404)
  })

  it('returns 404 when the return belongs to another customer (avoids leaking existence via 403)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindFirst.mockResolvedValue({ ...returnRequest, userId: 'other-user' })

    const response = await GET(getRequest(), { params })

    expect(response.status).toBe(404)
  })

  it("returns the caller's own return", async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindFirst.mockResolvedValue(returnRequest)

    const response = await GET(getRequest(), { params })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.id).toBe('ret0001')
  })

  it('handles unexpected errors', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindFirst.mockRejectedValue(new Error('db down'))

    const response = await GET(getRequest(), { params })

    expect(response.status).toBe(500)
  })
})
