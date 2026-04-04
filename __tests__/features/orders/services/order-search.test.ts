import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect,
  mockGetCachedData,
  mockLogError,
  mockSearchAllOrdersRedis,
  mockSearchUserOrdersRedis,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockGetCachedData: vi.fn(),
  mockLogError: vi.fn(),
  mockSearchAllOrdersRedis: vi.fn(),
  mockSearchUserOrdersRedis: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    select: mockSelect,
  },
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: mockGetCachedData,
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

vi.mock('@/features/orders/actions/orders', () => ({
  searchAllOrdersRedis: mockSearchAllOrdersRedis,
  searchUserOrdersRedis: mockSearchUserOrdersRedis,
}))

vi.mock('@/lib/schema', () => ({
  orders: {
    id: 'id',
    userId: 'userId',
    customerName: 'customerName',
    customerEmail: 'customerEmail',
    status: 'status',
    createdAt: 'createdAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  eq: vi.fn(),
  ilike: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
}))

import { searchOrderIds } from '@/features/orders/services/order-search'

describe('order-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchOrderIds', () => {
    it('returns empty array for empty search term', async () => {
      const result = await searchOrderIds('')
      expect(result).toEqual([])
    })

    it('returns empty array for whitespace-only search term', async () => {
      const result = await searchOrderIds('   ')
      expect(result).toEqual([])
    })

    it('returns Redis results when available (all users)', async () => {
      mockSearchAllOrdersRedis.mockResolvedValue(['ord1', 'ord2'])
      const result = await searchOrderIds('test')
      expect(result).toEqual(['ord1', 'ord2'])
      expect(mockSearchAllOrdersRedis).toHaveBeenCalledWith(
        'test',
        1000,
        undefined
      )
    })

    it('returns Redis results for specific user', async () => {
      mockSearchUserOrdersRedis.mockResolvedValue(['ord1'])
      const result = await searchOrderIds('test', { userId: 'user1' })
      expect(result).toEqual(['ord1'])
      expect(mockSearchUserOrdersRedis).toHaveBeenCalledWith(
        'user1',
        'test',
        1000,
        undefined
      )
    })

    it('falls back to cached database search when Redis returns null', async () => {
      mockSearchAllOrdersRedis.mockResolvedValue(null)
      mockGetCachedData.mockResolvedValue(['ord1', 'ord3'])
      const result = await searchOrderIds('test')
      expect(result).toEqual(['ord1', 'ord3'])
      expect(mockGetCachedData).toHaveBeenCalled()
    })

    it('falls back to cached DB search when Redis throws', async () => {
      mockSearchAllOrdersRedis.mockRejectedValue(new Error('Redis down'))
      mockGetCachedData.mockResolvedValue(['ord1'])
      const result = await searchOrderIds('test')
      expect(result).toEqual(['ord1'])
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'order_search_redis' })
      )
    })

    it('returns null when both Redis and database fail', async () => {
      mockSearchAllOrdersRedis.mockRejectedValue(new Error('Redis down'))
      mockGetCachedData.mockRejectedValue(new Error('DB down'))
      const result = await searchOrderIds('test')
      expect(result).toBeNull()
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'order_search_database' })
      )
    })

    it('passes status filter to Redis', async () => {
      mockSearchAllOrdersRedis.mockResolvedValue([])
      await searchOrderIds('test', { status: 'PENDING' })
      expect(mockSearchAllOrdersRedis).toHaveBeenCalledWith(
        'test',
        1000,
        'PENDING'
      )
    })

    it('invokes database fetcher via getCachedData with correct params', async () => {
      mockSearchAllOrdersRedis.mockResolvedValue(null)

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue([{ id: 'ord-db1' }, { id: 'ord-db2' }]),
      }
      mockSelect.mockReturnValue(mockChain)

      mockGetCachedData.mockImplementation(
        async (
          _key: string,
          _ttl: number,
          fetcher: () => Promise<string[]>
        ) => {
          return fetcher()
        }
      )

      const result = await searchOrderIds('test')
      expect(result).toEqual(['ord-db1', 'ord-db2'])
      expect(mockSelect).toHaveBeenCalled()
    })

    it('database fetcher applies userId filter', async () => {
      mockSearchUserOrdersRedis.mockResolvedValue(null)

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'ord-user1' }]),
      }
      mockSelect.mockReturnValue(mockChain)

      mockGetCachedData.mockImplementation(
        async (
          _key: string,
          _ttl: number,
          fetcher: () => Promise<string[]>
        ) => {
          return fetcher()
        }
      )

      const result = await searchOrderIds('test', { userId: 'user1' })
      expect(result).toEqual(['ord-user1'])
    })

    it('database fetcher applies status filter', async () => {
      mockSearchAllOrdersRedis.mockResolvedValue(null)

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      mockSelect.mockReturnValue(mockChain)

      mockGetCachedData.mockImplementation(
        async (
          _key: string,
          _ttl: number,
          fetcher: () => Promise<string[]>
        ) => {
          return fetcher()
        }
      )

      const result = await searchOrderIds('test', { status: 'SHIPPED' })
      expect(result).toEqual([])
    })

    it('respects custom limit parameter', async () => {
      mockSearchAllOrdersRedis.mockResolvedValue(null)

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      mockSelect.mockReturnValue(mockChain)

      mockGetCachedData.mockImplementation(
        async (
          _key: string,
          _ttl: number,
          fetcher: () => Promise<string[]>
        ) => {
          return fetcher()
        }
      )

      await searchOrderIds('test', { limit: 10 })
      expect(mockChain.limit).toHaveBeenCalledWith(10)
    })

    it('clamps limit to max 1000', async () => {
      mockSearchAllOrdersRedis.mockResolvedValue(null)

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      mockSelect.mockReturnValue(mockChain)

      mockGetCachedData.mockImplementation(
        async (
          _key: string,
          _ttl: number,
          fetcher: () => Promise<string[]>
        ) => {
          return fetcher()
        }
      )

      await searchOrderIds('test', { limit: 5000 })
      expect(mockChain.limit).toHaveBeenCalledWith(1000)
    })
  })
})
