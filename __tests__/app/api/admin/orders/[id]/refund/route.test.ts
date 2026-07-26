import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: { query: { orders: { findFirst: mockFindFirst } } },
}))
vi.mock('@/lib/schema', () => ({ orders: { id: 'id' } }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))
vi.mock('@/lib/serializers', () => ({
  serializeOrder: vi.fn((order) => ({ ...order, serialized: true })),
}))
vi.mock('@/features/orders/services/refund-service', () => ({
  refundOrder: vi.fn(),
  isRefundRequestError: (error: unknown) =>
    error instanceof Error && error.name === 'RefundRequestError',
}))
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

import { POST } from '@/app/api/admin/orders/[id]/refund/route'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { refundOrder } from '@/features/orders/services/refund-service'

const mockCheckAdminAuth = vi.mocked(checkAdminAuth)
const mockRefundOrder = vi.mocked(refundOrder)

const makeRequest = (body?: unknown) =>
  new NextRequest('http://localhost/api/admin/orders/order1/refund', {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const params = Promise.resolve({ id: 'order1' })

const refundResult = {
  refund: {
    id: 'ref1',
    orderId: 'order1',
    amount: 100,
    status: 'PROCESSED' as const,
    gatewayRefundId: 'rfnd_1',
    reason: null,
  },
  refundedTotal: 100,
  refundableBalance: 0,
  restocked: true,
}

describe('POST /api/admin/orders/[id]/refund', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin1',
      role: 'ADMIN',
      status: 200,
    } as never)
    mockRefundOrder.mockResolvedValue(refundResult)
    mockFindFirst.mockResolvedValue({ id: 'order1', items: [] })
  })

  it('requires the orders:refund permission', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Forbidden',
      status: 403,
    } as never)

    const response = await POST(makeRequest(), { params })

    expect(response.status).toBe(403)
    expect(mockCheckAdminAuth).toHaveBeenCalledWith('orders:refund')
    expect(mockRefundOrder).not.toHaveBeenCalled()
  })

  it('issues a full refund when no amount is supplied', async () => {
    const response = await POST(makeRequest(), { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockRefundOrder).toHaveBeenCalledWith({
      orderId: 'order1',
      amount: undefined,
      reason: null,
      actor: { userId: 'admin1', role: 'ADMIN' },
    })
    expect(data.data.refund.id).toBe('ref1')
    expect(data.data.order.serialized).toBe(true)
  })

  it('issues a partial refund with a reason', async () => {
    await POST(makeRequest({ amount: 25.5, reason: 'Damaged item' }), {
      params,
    })

    expect(mockRefundOrder).toHaveBeenCalledWith({
      orderId: 'order1',
      amount: 25.5,
      reason: 'Damaged item',
      actor: { userId: 'admin1', role: 'ADMIN' },
    })
  })

  it('rejects an invalid refund amount', async () => {
    const response = await POST(makeRequest({ amount: -5 }), { params })

    expect(response.status).toBe(400)
    expect(mockRefundOrder).not.toHaveBeenCalled()
  })

  it('maps a refund business error onto its status', async () => {
    const error = new Error('Order has already been fully refunded')
    error.name = 'RefundRequestError'
    Object.assign(error, { status: 409 })
    mockRefundOrder.mockRejectedValue(error)

    const response = await POST(makeRequest(), { params })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBe('Order has already been fully refunded')
  })

  it('returns 404 when the refunded order cannot be reloaded', async () => {
    mockFindFirst.mockResolvedValue(undefined)

    const response = await POST(makeRequest(), { params })

    expect(response.status).toBe(404)
  })
})
