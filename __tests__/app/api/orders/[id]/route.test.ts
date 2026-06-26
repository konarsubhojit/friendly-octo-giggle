import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PATCH } from '@/app/api/orders/[id]/route'
import { primaryDrizzleDb } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getCachedData, invalidateCache } from '@/lib/redis'
import { invalidateUserOrderCaches } from '@/lib/cache'

const mockTransaction = vi.hoisted(() =>
  vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
    }
    return callback(tx)
  })
)

const mockDb = vi.hoisted(() => ({
  query: { orders: { findFirst: vi.fn() } },
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(),
    })),
  })),
  transaction: mockTransaction,
}))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: mockDb,
  drizzleDb: mockDb,
}))

vi.mock('@/lib/schema', () => ({
  orders: { id: 'id', status: 'status' },
  productVariants: { id: 'id', stock: 'stock' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: vi.fn(),
  invalidateCache: vi.fn(),
  getRedisClient: vi.fn(() => null),
}))

vi.mock('@/lib/cache', () => ({
  CACHE_KEYS: {
    ORDER_BY_ID: (userId: string, orderId: string) =>
      `order:${userId}:${orderId}`,
    PRODUCTS_BESTSELLERS: 'products:bestsellers',
    PRODUCTS_BESTSELLERS_PATTERN: 'products:bestsellers*',
  },
  CACHE_TTL: { ORDER_DETAIL: 120, ORDER_DETAIL_STALE: 10 },
  invalidateUserOrderCaches: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

const mockAuth = vi.mocked(auth)
const mockGetCachedData = vi.mocked(getCachedData)
const mockInvalidateCache = vi.mocked(invalidateCache)
const mockInvalidateUserOrderCaches = vi.mocked(invalidateUserOrderCaches)
const mockFindFirst = vi.mocked(primaryDrizzleDb.query.orders.findFirst)

describe('GET /api/orders/[id]', () => {
  const mockOrder = {
    id: 'order1',
    userId: 'user1',
    totalAmount: 100,
    status: 'PENDING',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    items: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never)

    const request = new NextRequest('http://localhost/api/orders/order1')
    const response = await GET(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Authentication required')
  })

  it('returns 404 when order not found (getCachedData returns null)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)
    mockGetCachedData.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/orders/order1')
    const response = await GET(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Order not found')
  })

  it('returns 404 when order belongs to different user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)
    mockGetCachedData.mockResolvedValue({
      ...mockOrder,
      userId: 'differentUser',
    })

    const request = new NextRequest('http://localhost/api/orders/order1')
    const response = await GET(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Order not found')
  })

  it('returns order on success', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)
    mockGetCachedData.mockResolvedValue(mockOrder)

    const request = new NextRequest('http://localhost/api/orders/order1')
    const response = await GET(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.order).toBeDefined()
    expect(data.data.order.id).toBe('order1')
    expect(data.data.order.createdAt).toBe('2024-01-01T00:00:00.000Z')
  })
})

describe('PATCH /api/orders/[id]', () => {
  const mockOrder = {
    id: 'order1',
    userId: 'user1',
    totalAmount: 100,
    status: 'PENDING',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    items: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never)

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Authentication required')
  })

  it('returns 400 for invalid action', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'invalid' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('returns 404 when order not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)
    mockFindFirst.mockResolvedValue(null as never)

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Order not found')
  })

  it('returns 404 when order belongs to different user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)
    mockFindFirst.mockResolvedValue({
      ...mockOrder,
      userId: 'differentUser',
    } as never)

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Order not found')
  })

  it('returns 400 when order is not PENDING', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)
    mockFindFirst.mockResolvedValue({
      ...mockOrder,
      status: 'SHIPPED',
    } as never)

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Only pending orders can be cancelled')
  })

  it('cancels order successfully', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)

    const cancelledOrder = { ...mockOrder, status: 'CANCELLED' }

    mockFindFirst
      .mockResolvedValueOnce(mockOrder as never)
      .mockResolvedValueOnce(cancelledOrder as never)

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.order).toBeDefined()
    expect(data.data.order.id).toBe('order1')
    expect(data.data.order.status).toBe('CANCELLED')
    expect(mockTransaction).toHaveBeenCalled()
    expect(mockInvalidateUserOrderCaches).toHaveBeenCalledWith('user1')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:orders:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:order:order1')
    expect(mockInvalidateCache).toHaveBeenCalledWith('products:bestsellers*')
  })

  it('restores stock for items with variantId on cancellation', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)

    const orderWithItems = {
      ...mockOrder,
      items: [
        { id: 'oi1', variantId: 'v1', quantity: 2 },
        { id: 'oi2', variantId: 'v2', quantity: 1 },
      ],
    }
    // Second findFirst (for response) returns the base cancelled order with empty items
    const cancelledOrder = { ...mockOrder, status: 'CANCELLED' }

    mockFindFirst
      .mockResolvedValueOnce(orderWithItems as never)
      .mockResolvedValueOnce(cancelledOrder as never)

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })

    expect(response.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalled()
    // The transaction callback receives a tx with update; verify it ran
    const txCallback = mockTransaction.mock.calls[0][0]
    const mockTx = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
    }
    await txCallback(mockTx)
    // update called once for order status + once per item (2 items)
    expect(mockTx.update).toHaveBeenCalledTimes(3)
  })

  it('returns 500 when updatedOrder is null after cancel', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)

    mockFindFirst
      .mockResolvedValueOnce(mockOrder as never)
      .mockResolvedValueOnce(null as never)

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Order not found after update')
  })

  it('returns 500 on unexpected error in GET', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)
    mockGetCachedData.mockRejectedValue(new Error('Cache failure'))

    const request = new NextRequest('http://localhost/api/orders/order1')
    const response = await GET(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('returns 500 on unexpected error in PATCH', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user1', name: 'Test', email: 'test@example.com' },
    } as never)
    mockFindFirst.mockRejectedValue(new Error('DB failure'))

    const request = new NextRequest('http://localhost/api/orders/order1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    })
    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'order1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })
})
