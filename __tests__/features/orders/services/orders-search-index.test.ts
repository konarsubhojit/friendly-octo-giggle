import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetRedisClient,
  mockIsRedisAvailable,
  mockLogError,
  mockDrizzleDbQuery,
} = vi.hoisted(() => ({
  mockGetRedisClient: vi.fn(),
  mockIsRedisAvailable: vi.fn(),
  mockLogError: vi.fn(),
  mockDrizzleDbQuery: {
    orders: { findMany: vi.fn() },
  },
}))

const mockPipeline = {
  hset: vi.fn().mockReturnThis(),
  sadd: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
}

const mockSearchIndex = {
  describe: vi.fn(),
}

const mockRedisClient = {
  pipeline: vi.fn(() => mockPipeline),
  search: {
    index: vi.fn(() => mockSearchIndex),
    createIndex: vi.fn().mockResolvedValue(undefined),
  },
}

vi.mock('@/lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
  isRedisAvailable: mockIsRedisAvailable,
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: mockDrizzleDbQuery,
  },
}))

vi.mock('@/lib/schema', () => ({
  orders: {
    createdAt: 'createdAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
  s: {
    object: vi.fn().mockReturnValue({
      id: 'id',
      customerName: 'customerName',
    }),
    string: vi.fn().mockReturnValue({
      noTokenize: vi.fn().mockReturnValue('noTokenize'),
    }),
    keyword: vi.fn().mockReturnValue('keyword'),
  },
}))

import {
  ensureOrdersSearchIndex,
  backfillOrdersSearchIndex,
  createOrRefreshOrdersSearchIndex,
  areOrdersSearchControlsAvailable,
} from '@/features/orders/services/orders-search-index'

describe('orders-search-index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRedisClient.mockReturnValue(mockRedisClient)
  })

  describe('areOrdersSearchControlsAvailable', () => {
    it('returns true when Redis is available', () => {
      mockIsRedisAvailable.mockReturnValue(true)
      expect(areOrdersSearchControlsAvailable()).toBe(true)
    })

    it('returns false when Redis is not available', () => {
      mockIsRedisAvailable.mockReturnValue(false)
      expect(areOrdersSearchControlsAvailable()).toBe(false)
    })
  })

  describe('ensureOrdersSearchIndex', () => {
    it('returns indexCreated=false when index already exists', async () => {
      mockSearchIndex.describe.mockResolvedValue({
        indexName: 'orders',
        numDocs: 10,
      })

      const result = await ensureOrdersSearchIndex()

      expect(result).toEqual({ indexCreated: false })
      expect(mockRedisClient.search.createIndex).not.toHaveBeenCalled()
    })

    it('creates index when it does not exist', async () => {
      mockSearchIndex.describe.mockResolvedValue(null)

      const result = await ensureOrdersSearchIndex()

      expect(result).toEqual({ indexCreated: true })
      expect(mockRedisClient.search.createIndex).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'orders',
          dataType: 'hash',
          prefix: 'order:',
        })
      )
    })

    it('throws when Redis is not configured', async () => {
      mockGetRedisClient.mockReturnValue(null)

      await expect(ensureOrdersSearchIndex()).rejects.toThrow(
        'Redis Search is not configured'
      )
    })
  })

  describe('backfillOrdersSearchIndex', () => {
    it('writes all orders to Redis', async () => {
      const orders = [
        {
          id: 'ord1',
          userId: 'user1',
          customerName: 'Alice',
          customerEmail: 'alice@example.com',
          customerAddress: '123 St',
          totalAmount: 100,
          status: 'PENDING',
          createdAt: new Date('2024-01-01'),
          items: [
            {
              productId: 'p1',
              variationId: null,
              quantity: 1,
              price: 100,
              customizationNote: null,
              product: { name: 'Widget' },
              variation: null,
            },
          ],
        },
      ]
      mockDrizzleDbQuery.orders.findMany.mockResolvedValue(orders)

      const count = await backfillOrdersSearchIndex()

      expect(count).toBe(1)
      expect(mockPipeline.hset).toHaveBeenCalled()
      expect(mockPipeline.sadd).toHaveBeenCalled()
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    it('returns 0 when no orders exist', async () => {
      mockDrizzleDbQuery.orders.findMany.mockResolvedValue([])

      const count = await backfillOrdersSearchIndex()

      expect(count).toBe(0)
    })

    it('throws when Redis is not configured', async () => {
      mockGetRedisClient.mockReturnValue(null)

      await expect(backfillOrdersSearchIndex()).rejects.toThrow(
        'Redis Search is not configured'
      )
    })

    it('handles orders without userId', async () => {
      const orders = [
        {
          id: 'ord1',
          userId: null,
          customerName: 'Guest',
          customerEmail: 'guest@example.com',
          customerAddress: '456 Ave',
          totalAmount: 50,
          status: 'COMPLETED',
          createdAt: new Date('2024-01-01'),
          items: [
            {
              productId: 'p1',
              variantId: null,
              quantity: 1,
              price: 50,
              customizationNote: null,
              product: { name: 'Gadget' },
              variant: null,
            },
          ],
        },
      ]
      mockDrizzleDbQuery.orders.findMany.mockResolvedValue(orders)

      const count = await backfillOrdersSearchIndex()

      expect(count).toBe(1)
      expect(mockPipeline.hset).toHaveBeenCalled()
    })

    it('builds productNames from product names', async () => {
      const orders = [
        {
          id: 'ord1',
          userId: 'user1',
          customerName: 'Bob',
          customerEmail: 'bob@test.com',
          customerAddress: '789 Rd',
          totalAmount: 200,
          status: 'DELIVERED',
          createdAt: new Date('2024-01-01'),
          items: [
            {
              productId: 'p1',
              variantId: 'v1',
              quantity: 1,
              price: 120,
              customizationNote: null,
              product: { name: 'Widget' },
              variant: { sku: 'Blue' },
            },
            {
              productId: 'p2',
              variantId: null,
              quantity: 1,
              price: 80,
              customizationNote: null,
              product: { name: 'Gadget' },
              variant: null,
            },
          ],
        },
      ]
      mockDrizzleDbQuery.orders.findMany.mockResolvedValue(orders)

      const count = await backfillOrdersSearchIndex()

      expect(count).toBe(1)
      expect(mockPipeline.hset).toHaveBeenCalledWith(
        'order:ord1',
        expect.objectContaining({
          productNames: 'Widget, Gadget',
        })
      )
    })
  })

  describe('createOrRefreshOrdersSearchIndex', () => {
    it('creates index and backfills', async () => {
      mockSearchIndex.describe.mockResolvedValue(null)
      mockDrizzleDbQuery.orders.findMany.mockResolvedValue([])

      const result = await createOrRefreshOrdersSearchIndex()

      expect(result).toEqual({
        indexedOrders: 0,
        indexCreated: true,
      })
    })

    it('skips index creation when it exists and backfills', async () => {
      mockSearchIndex.describe.mockResolvedValue({ numDocs: 5 })
      mockDrizzleDbQuery.orders.findMany.mockResolvedValue([
        {
          id: 'ord1',
          userId: 'user1',
          customerName: 'A',
          customerEmail: 'a@a.com',
          customerAddress: '1',
          totalAmount: 10,
          status: 'PENDING',
          createdAt: new Date(),
          items: [],
        },
      ])

      const result = await createOrRefreshOrdersSearchIndex()

      expect(result.indexCreated).toBe(false)
      expect(result.indexedOrders).toBe(1)
    })

    it('logs and rethrows errors', async () => {
      mockGetRedisClient.mockReturnValue(null)

      await expect(createOrRefreshOrdersSearchIndex()).rejects.toThrow()
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'orders_search_index' })
      )
    })
  })
})
