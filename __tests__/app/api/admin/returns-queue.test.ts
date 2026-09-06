import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCheckAdminAuth,
  mockWithItemsAndEvidence,
  mockSelectLimit,
  mockSelectOrderBy,
  mockSelectWhere,
  mockSelectInnerJoin,
  mockSelectFrom,
  mockSelect,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn()
  const mockSelectOrderBy = vi.fn(() => ({ limit: mockSelectLimit }))
  const mockSelectWhere = vi.fn(() => ({ orderBy: mockSelectOrderBy }))
  const mockSelectInnerJoin = vi.fn(() => ({ where: mockSelectWhere }))
  const mockSelectFrom = vi.fn(() => ({ innerJoin: mockSelectInnerJoin }))
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }))

  return {
    mockCheckAdminAuth: vi.fn(),
    mockWithItemsAndEvidence: vi.fn(),
    mockSelectLimit,
    mockSelectOrderBy,
    mockSelectWhere,
    mockSelectInnerJoin,
    mockSelectFrom,
    mockSelect,
  }
})

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: { select: mockSelect },
}))

vi.mock('@/lib/schema', () => ({
  returnRequests: {
    id: 'id',
    orderId: 'orderId',
    status: 'status',
    reason: 'reason',
    customerNote: 'customerNote',
    decisionReason: 'decisionReason',
    refundAmount: 'refundAmount',
    refundId: 'refundId',
    createdAt: 'createdAt',
  },
  orders: {
    id: 'id',
    customerName: 'customerName',
    customerEmail: 'customerEmail',
    paymentProvider: 'paymentProvider',
  },
}))

vi.mock('@/features/orders/services/return-queue', () => ({
  withItemsAndEvidence: mockWithItemsAndEvidence,
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

import { GET } from '@/app/api/admin/returns/route'

const makeRequest = (query = '') =>
  new NextRequest(`https://localhost/api/admin/returns${query}`)

const row = {
  id: 'ret0001',
  orderId: 'ORD1234567',
  status: 'REQUESTED',
  reason: 'DAMAGED',
  customerNote: null,
  decisionReason: null,
  refundAmount: null,
  refundId: null,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  paymentProvider: 'razorpay',
}

describe('GET /api/admin/returns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAdminAuth.mockResolvedValue({ authorized: true })
    mockSelectLimit.mockResolvedValue([row])
    mockWithItemsAndEvidence.mockImplementation(async (rows: unknown[]) => rows)
  })

  it('returns 403 when not authorized', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Forbidden',
      status: 403,
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(403)
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('returns the queue page with no next cursor when there is no extra row', async () => {
    mockSelectLimit.mockResolvedValue([row])

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.returns).toEqual([
      { ...row, createdAt: row.createdAt.toISOString() },
    ])
    expect(body.data.nextCursor).toBeNull()
    expect(mockSelectLimit).toHaveBeenCalledWith(21)
  })

  it('paginates with a next cursor when there is an extra row', async () => {
    const extraRow = {
      ...row,
      id: 'ret0002',
      createdAt: new Date('2026-02-02T00:00:00.000Z'),
    }
    mockSelectLimit.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        ...row,
        id: `ret${i}`,
        createdAt: new Date(2026, 1, 1 + i),
      })).concat(extraRow)
    )

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.returns).toHaveLength(20)
    expect(body.data.nextCursor).not.toBeNull()
  })

  it('filters by status and search and clamps limit', async () => {
    const response = await GET(
      makeRequest(
        '?status=REQUESTED&status=INVALID&search=jane&limit=500&cursor=2026-02-01T00:00:00.000Z'
      )
    )

    expect(response.status).toBe(200)
    expect(mockSelectLimit).toHaveBeenCalledWith(101)
    expect(mockSelectWhere).toHaveBeenCalled()
  })

  it('ignores an invalid cursor', async () => {
    const response = await GET(makeRequest('?cursor=not-a-date'))

    expect(response.status).toBe(200)
    expect(mockSelectWhere).toHaveBeenCalledWith(undefined)
  })

  it('handles unexpected errors', async () => {
    mockSelectLimit.mockRejectedValue(new Error('db down'))

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
  })
})
