import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindFirst = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() =>
  vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }))
)
const mockDb = vi.hoisted(() => ({
  query: { orders: { findFirst: mockFindFirst } },
  update: mockUpdate,
}))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: mockDb,
  drizzleDb: mockDb,
}))
vi.mock('@/lib/schema', () => ({ orders: { id: 'id' } }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/redis', () => ({
  getCachedData: vi.fn(),
  invalidateCache: vi.fn(),
  getRedisClient: vi.fn(() => null),
}))
vi.mock('@/lib/cache', () => ({
  cacheAdminOrderById: vi.fn(),
  invalidateAdminOrderCaches: vi.fn(),
}))
vi.mock('@/lib/serializers', () => ({
  serializeOrder: vi.fn((o) => ({ ...o, serialized: true })),
}))
vi.mock(
  '@/lib/validations',
  async () => await vi.importActual('@/lib/validations')
)
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendOrderStatusUpdateEmail: vi.fn(),
}))
vi.mock('@/lib/search', () => ({}))
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    QSTASH_TOKEN: 'test-token',
  },
}))
vi.mock('@/lib/qstash', () => ({
  getQStashClient: vi.fn(() => ({
    publishJSON: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
  })),
}))

import { PATCH, GET } from '@/app/api/admin/orders/[id]/route'
import { auth } from '@/lib/auth'
import { cacheAdminOrderById, invalidateAdminOrderCaches } from '@/lib/cache'

const mockAuth = vi.mocked(auth)
const mockCacheAdminOrderById = vi.mocked(cacheAdminOrderById)
const mockInvalidateAdminOrderCaches = vi.mocked(invalidateAdminOrderCaches)

const mkReq = (body?: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/orders/o1', {
    method: body ? 'PATCH' : 'GET',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

const mkParams = () => ({ params: Promise.resolve({ id: 'o1' }) })

const adminSession = {
  user: { id: 'u1', role: 'ADMIN', email: 'admin@test.com' },
  expires: new Date(Date.now() + 86400000).toISOString(),
}

const mockOrder = {
  id: 'o1',
  userId: 'u1',
  status: 'SHIPPED',
  total: 5000,
  totalAmount: 5000,
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  customerAddress: '123 Test St',
  trackingNumber: 'TRK123',
  shippingProvider: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  items: [{ id: 'i1', product: { id: 'p1' }, variant: null }],
}

describe('PATCH /api/admin/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never)

    const res = await PATCH(mkReq({ status: 'SHIPPED' }), mkParams())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Not authenticated')
  })

  it('returns 403 when not admin', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'USER', email: 'user@test.com' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never)

    const res = await PATCH(mkReq({ status: 'SHIPPED' }), mkParams())
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe('Not authorized - Admin access required')
  })

  it('returns 400 for invalid body', async () => {
    mockAuth.mockResolvedValue(adminSession as never)

    const res = await PATCH(mkReq({ invalid: true }), mkParams())
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('updates order successfully', async () => {
    mockAuth.mockResolvedValue(adminSession as never)
    mockUpdate.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn() })),
    } as never)
    mockFindFirst.mockResolvedValue(mockOrder as never)

    const res = await PATCH(
      mkReq({ status: 'SHIPPED', trackingNumber: 'TRK123' }),
      mkParams()
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.order.serialized).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockInvalidateAdminOrderCaches).toHaveBeenCalledWith('o1', 'u1')
  })

  it('returns 404 when order not found after update', async () => {
    mockAuth.mockResolvedValue(adminSession as never)
    mockUpdate.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn() })),
    } as never)
    mockFindFirst.mockResolvedValue(undefined as never)

    const res = await PATCH(mkReq({ status: 'SHIPPED' }), mkParams())
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('Order not found')
  })
})

describe('GET /api/admin/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never)

    const res = await GET(mkReq(), mkParams())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Not authenticated')
  })

  it('returns 403 when not admin', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u2', role: 'USER', email: 'user@test.com' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never)

    const res = await GET(mkReq(), mkParams())
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe('Not authorized - Admin access required')
  })

  it('returns order on success', async () => {
    mockAuth.mockResolvedValue(adminSession as never)
    mockCacheAdminOrderById.mockImplementation((_id, fetcher) => {
      return fetcher()
    })
    mockFindFirst.mockResolvedValue(mockOrder as never)

    const res = await GET(mkReq(), mkParams())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.order.serialized).toBe(true)
    expect(mockCacheAdminOrderById).toHaveBeenCalledWith(
      'o1',
      expect.any(Function)
    )
  })

  it('returns 404 when not found', async () => {
    mockAuth.mockResolvedValue(adminSession as never)
    mockCacheAdminOrderById.mockImplementation(() => Promise.resolve(null))

    const res = await GET(mkReq(), mkParams())
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('Order not found')
  })
})
