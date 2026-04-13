import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockInsert,
  mockUpdate,
  mockTransaction,
  mockGetRedisClient,
  mockLogError,
  mockLogBusinessEvent,
  mockGenerateOrderId,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetRedisClient: vi.fn(),
  mockLogError: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
  mockGenerateOrderId: vi.fn(() => 'ORD1234567'),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    insert: mockInsert,
    update: mockUpdate,
    transaction: mockTransaction,
    query: {
      products: {
        findMany: vi.fn(),
      },
      orders: {
        findMany: vi.fn(),
      },
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/cache', () => ({
  invalidateUserOrderCaches: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
  logBusinessEvent: mockLogBusinessEvent,
}))

vi.mock('@/lib/short-id', () => ({
  generateOrderId: mockGenerateOrderId,
  generateShortId: vi.fn(() => 'abc1234'),
}))

import {
  createOrder,
  updateOrderStatus,
  getUserOrders,
} from '@/features/orders/actions/orders'
import { drizzleDb } from '@/lib/db'

const validOrderData = {
  customerName: 'Alice Smith',
  customerEmail: 'alice@example.com',
  customerAddress: '123 Main Street, London, UK',
  addressLine1: '123 Main Street',
  addressLine2: '',
  addressLine3: '',
  pinCode: '110001',
  city: 'New Delhi',
  state: 'Delhi',
  items: [
    { productId: 'prod001', quantity: 2, price: 25 },
    { productId: 'prod002', variationId: 'var001', quantity: 1, price: 50 },
  ],
}

const makeMockRedis = () => ({
  hset: vi.fn().mockResolvedValue(1),
  sadd: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  hgetall: vi.fn().mockResolvedValue(null),
  pipeline: vi.fn(() => ({
    hset: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    hgetall: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
})

const makeMockTx = () => ({
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  }),
})

describe('createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRedisClient.mockReturnValue(makeMockRedis())
    mockTransaction.mockImplementation(
      async (cb: (tx: ReturnType<typeof makeMockTx>) => Promise<void>) => {
        await cb(makeMockTx())
      }
    )
    vi.mocked(drizzleDb.query.products.findMany).mockResolvedValue([
      { id: 'prod001', name: 'Test Product A', variations: [] },
      {
        id: 'prod002',
        name: 'Test Product B',
        variations: [{ id: 'var001', name: 'Blue' }],
      },
    ] as never)
  })

  it('inserts into PostgreSQL and returns orderId on success', async () => {
    const result = await createOrder('user-123', validOrderData)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.orderId).toBe('ORD1234567')
    }
    expect(mockTransaction).toHaveBeenCalledOnce()
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'order_created', success: true })
    )
  })

  it('returns error when customerName is missing', async () => {
    const result = await createOrder('user-123', {
      ...validOrderData,
      customerName: '',
    })

    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns error when items array is empty', async () => {
    const result = await createOrder('user-123', {
      ...validOrderData,
      items: [],
    })

    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns error when PostgreSQL transaction fails but does not crash', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('DB connection refused'))

    const result = await createOrder('user-123', validOrderData)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to create order')
    }
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'create_order_pg' })
    )
  })

  it('still succeeds when Redis is unavailable (getRedisClient returns null)', async () => {
    mockGetRedisClient.mockReturnValue(null)

    const result = await createOrder('user-123', validOrderData)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.orderId).toBe('ORD1234567')
    }
  })
})

describe('updateOrderStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRedisClient.mockReturnValue(makeMockRedis())
  })

  it('updates status in PostgreSQL and Redis on success', async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'ORD1234567' }]),
    }
    mockUpdate.mockReturnValue(updateChain)

    const result = await updateOrderStatus('ORD1234567', 'PROCESSING')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.orderId).toBe('ORD1234567')
    }
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'order_status_updated', success: true })
    )
  })

  it('returns error when order is not found in PostgreSQL', async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    }
    mockUpdate.mockReturnValue(updateChain)

    const result = await updateOrderStatus('ORD_MISSING', 'SHIPPED')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Order not found')
    }
  })

  it('returns error for invalid status value', async () => {
    const result = await updateOrderStatus('ORD1234567', 'INVALID_STATUS')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Invalid order status')
    }
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('still succeeds when Redis hset fails after PG update succeeds', async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'ORD1234567' }]),
    }
    mockUpdate.mockReturnValue(updateChain)

    const mockRedis = makeMockRedis()
    mockRedis.hset.mockRejectedValueOnce(new Error('Redis timeout'))
    mockGetRedisClient.mockReturnValue(mockRedis)

    const result = await updateOrderStatus('ORD1234567', 'DELIVERED')

    expect(result.success).toBe(true)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'update_order_status_redis' })
    )
  })

  it('returns error when PostgreSQL update fails', async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(new Error('DB error')),
    }
    mockUpdate.mockReturnValue(updateChain)

    const result = await updateOrderStatus('ORD1234567', 'CANCELLED')

    expect(result.success).toBe(false)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'update_order_status_pg' })
    )
  })
})

describe('getUserOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const redisOrderHash = (orderId: string) => ({
    id: orderId,
    userId: 'user-123',
    customerName: 'Alice Smith',
    customerEmail: 'alice@example.com',
    customerAddress: '123 Main Street, London, UK',
    addressLine1: '123 Main Street',
    addressLine2: '',
    addressLine3: '',
    pinCode: '110001',
    city: 'New Delhi',
    state: 'Delhi',
    items: JSON.stringify([{ productId: 'prod001', quantity: 1, price: 25 }]),
    total: '25',
    status: 'PENDING',
    createdAt: '2026-01-01T00:00:00.000Z',
  })

  it('returns orders from Redis when available', async () => {
    const mockRedis = makeMockRedis()
    mockRedis.smembers.mockResolvedValue(['ORD1234567'])
    const mockPipeline = {
      hset: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      hgetall: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([redisOrderHash('ORD1234567')]),
    }
    mockRedis.pipeline.mockReturnValue(mockPipeline)
    mockGetRedisClient.mockReturnValue(mockRedis)

    const result = await getUserOrders('user-123')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('ORD1234567')
      expect(result.data[0].status).toBe('PENDING')
    }
  })

  it('returns empty list when user has no orders in Redis and no PG rows', async () => {
    const mockRedis = makeMockRedis()
    mockGetRedisClient.mockReturnValue(mockRedis)

    const dbQuery = vi.fn().mockResolvedValue([])
    const { drizzleDb } = await import('@/lib/db')
    vi.mocked(drizzleDb.query.orders.findMany).mockImplementation(dbQuery)

    const result = await getUserOrders('user-no-orders')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(0)
    }
  })

  it('falls back to PostgreSQL when Redis is unavailable', async () => {
    mockGetRedisClient.mockReturnValue(null)

    const dbRow = {
      id: 'ORD1234567',
      checkoutRequestId: 'chk-1234567',
      userId: 'user-123',
      customerName: 'Alice Smith',
      customerEmail: 'alice@example.com',
      customerAddress: '123 Main Street, London, UK',
      addressLine1: '123 Main Street',
      addressLine2: '',
      addressLine3: '',
      pinCode: '110001',
      city: 'New Delhi',
      state: 'Delhi',
      totalAmount: 50,
      status: 'PENDING' as const,
      trackingNumber: null,
      shippingProvider: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      items: [
        {
          id: 'item001',
          orderId: 'ORD1234567',
          productId: 'prod001',
          variationId: null,
          quantity: 2,
          price: 25,
          customizationNote: null,
        },
      ],
    }

    const { drizzleDb } = await import('@/lib/db')
    vi.mocked(drizzleDb.query.orders.findMany).mockResolvedValue([dbRow])

    const result = await getUserOrders('user-123')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].total).toBe(50)
    }
  })

  it('returns error when both Redis and PostgreSQL fail', async () => {
    mockGetRedisClient.mockReturnValue(null)

    const { drizzleDb } = await import('@/lib/db')
    vi.mocked(drizzleDb.query.orders.findMany).mockRejectedValue(
      new Error('DB down')
    )

    const result = await getUserOrders('user-123')

    expect(result.success).toBe(false)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'get_orders_pg' })
    )
  })

  it('fetches orphaned order IDs from PostgreSQL and merges into result', async () => {
    const mockRedis = makeMockRedis()
    mockRedis.smembers.mockResolvedValue(['ORD1234567', 'ORD_ORPHAN'])
    const mockPipeline = {
      hset: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      hgetall: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([redisOrderHash('ORD1234567'), null]),
    }
    mockRedis.pipeline.mockReturnValue(mockPipeline)
    mockGetRedisClient.mockReturnValue(mockRedis)

    const orphanRow = {
      id: 'ORD_ORPHAN',
      checkoutRequestId: 'chk-orphan-001',
      userId: 'user-123',
      customerName: 'Alice Smith',
      customerEmail: 'alice@example.com',
      customerAddress: '123 Main Street, London, UK',
      addressLine1: '123 Main Street',
      addressLine2: '',
      addressLine3: '',
      pinCode: '110001',
      city: 'New Delhi',
      state: 'Delhi',
      totalAmount: 30,
      status: 'SHIPPED' as const,
      trackingNumber: null,
      shippingProvider: null,
      createdAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
      items: [],
    }

    const { drizzleDb } = await import('@/lib/db')
    vi.mocked(drizzleDb.query.orders.findMany).mockResolvedValue([orphanRow])

    const result = await getUserOrders('user-123')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      const ids = result.data.map((o) => o.id)
      expect(ids).toContain('ORD1234567')
      expect(ids).toContain('ORD_ORPHAN')
    }
  })
})
