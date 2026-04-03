import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRedisClient = {
  get: vi.fn(),
  setex: vi.fn(),
}

vi.mock('@/lib/redis', () => ({
  getCachedData: vi.fn(),
  invalidateCache: vi.fn(),
  getRedisClient: vi.fn(() => mockRedisClient),
}))

vi.mock('@/lib/logger', () => ({
  logCacheOperation: vi.fn(),
  logError: vi.fn(),
}))

import {
  buildAdminProductsCacheKey,
  cacheAdminProductsList,
  buildUserOrdersCacheKey,
  cacheUserOrdersList,
  buildAdminUsersCacheKey,
  cacheAdminUsersList,
  invalidateAdminOrderCaches,
  invalidateAdminUserCaches,
  cacheAdminSales,
  cacheShareResolve,
  cacheUserSession,
  invalidateUserSessionCache,
  CACHE_KEYS,
} from '@/lib/cache'
import { getCachedData, invalidateCache } from '@/lib/redis'
import { logError } from '@/lib/logger'

const mockGetCachedData = vi.mocked(getCachedData)
const mockInvalidateCache = vi.mocked(invalidateCache)
const mockLogError = vi.mocked(logError)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cache - extended coverage', () => {
  describe('buildAdminProductsCacheKey', () => {
    it('returns empty string for search queries', () => {
      expect(buildAdminProductsCacheKey({ search: 'test' })).toBe('')
    })

    it('includes cursor in key', () => {
      expect(buildAdminProductsCacheKey({ cursor: 'abc123' })).toContain(
        'c:abc123'
      )
    })

    it('includes offset when no cursor', () => {
      expect(buildAdminProductsCacheKey({ offset: 20 })).toContain('o:20')
    })

    it('prefers cursor over offset', () => {
      const key = buildAdminProductsCacheKey({ cursor: 'abc', offset: 20 })
      expect(key).toContain('c:abc')
      expect(key).not.toContain('o:20')
    })

    it('includes limit in key', () => {
      expect(buildAdminProductsCacheKey({ limit: 50 })).toContain('l:50')
    })

    it('returns base key with no params', () => {
      expect(buildAdminProductsCacheKey({})).toBe(CACHE_KEYS.ADMIN_PRODUCTS_ALL)
    })
  })

  describe('cacheAdminProductsList', () => {
    it('bypasses cache for search queries', async () => {
      const fetcher = vi.fn().mockResolvedValue([])
      await cacheAdminProductsList(fetcher, { search: 'test' })
      expect(fetcher).toHaveBeenCalled()
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })

    it('uses cache for non-search queries', async () => {
      mockGetCachedData.mockResolvedValue([])
      const fetcher = vi.fn()
      await cacheAdminProductsList(fetcher)
      expect(mockGetCachedData).toHaveBeenCalled()
    })
  })

  describe('buildUserOrdersCacheKey', () => {
    it('returns empty string for search queries', () => {
      expect(buildUserOrdersCacheKey({ userId: 'u1', search: 'test' })).toBe('')
    })

    it('includes userId in key', () => {
      expect(buildUserOrdersCacheKey({ userId: 'u1' })).toContain('u1')
    })

    it('includes cursor', () => {
      expect(
        buildUserOrdersCacheKey({ userId: 'u1', cursor: 'abc' })
      ).toContain('c:abc')
    })

    it('includes offset when no cursor', () => {
      expect(buildUserOrdersCacheKey({ userId: 'u1', offset: 10 })).toContain(
        'o:10'
      )
    })

    it('includes limit', () => {
      expect(buildUserOrdersCacheKey({ userId: 'u1', limit: 25 })).toContain(
        'l:25'
      )
    })
  })

  describe('cacheUserOrdersList', () => {
    it('bypasses cache for search queries', async () => {
      const fetcher = vi.fn().mockResolvedValue([])
      await cacheUserOrdersList(fetcher, { userId: 'u1', search: 'test' })
      expect(fetcher).toHaveBeenCalled()
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })

    it('uses cache for non-search queries', async () => {
      mockGetCachedData.mockResolvedValue([])
      const fetcher = vi.fn()
      await cacheUserOrdersList(fetcher, { userId: 'u1' })
      expect(mockGetCachedData).toHaveBeenCalled()
    })
  })

  describe('buildAdminUsersCacheKey', () => {
    it('returns empty string for search queries', () => {
      expect(buildAdminUsersCacheKey({ search: 'test' })).toBe('')
    })

    it('includes cursor', () => {
      expect(buildAdminUsersCacheKey({ cursor: 'abc' })).toContain('c:abc')
    })

    it('includes limit', () => {
      expect(buildAdminUsersCacheKey({ limit: 10 })).toContain('l:10')
    })
  })

  describe('cacheAdminUsersList', () => {
    it('bypasses cache for search queries', async () => {
      const fetcher = vi.fn().mockResolvedValue([])
      await cacheAdminUsersList(fetcher, { search: 'test' })
      expect(fetcher).toHaveBeenCalled()
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })

    it('uses cache for non-search queries', async () => {
      mockGetCachedData.mockResolvedValue([])
      const fetcher = vi.fn()
      await cacheAdminUsersList(fetcher)
      expect(mockGetCachedData).toHaveBeenCalled()
    })
  })

  describe('invalidateAdminOrderCaches', () => {
    it('invalidates all admin order patterns', async () => {
      await invalidateAdminOrderCaches('ord1')
      expect(mockInvalidateCache).toHaveBeenCalledTimes(4)
    })

    it('also invalidates user order caches when userId provided', async () => {
      await invalidateAdminOrderCaches('ord1', 'user1')
      expect(mockInvalidateCache).toHaveBeenCalledTimes(6)
    })

    it('handles errors gracefully', async () => {
      mockInvalidateCache.mockRejectedValueOnce(new Error('Redis down'))
      await invalidateAdminOrderCaches('ord1')
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'admin_order_cache_invalidation',
        })
      )
    })
  })

  describe('invalidateAdminUserCaches', () => {
    it('invalidates user patterns', async () => {
      await invalidateAdminUserCaches('user1')
      expect(mockInvalidateCache).toHaveBeenCalledTimes(2)
    })

    it('handles errors gracefully', async () => {
      mockInvalidateCache.mockRejectedValueOnce(new Error('Redis down'))
      await invalidateAdminUserCaches('user1')
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'admin_user_cache_invalidation',
        })
      )
    })
  })

  describe('cacheAdminSales', () => {
    it('uses getCachedData', async () => {
      mockGetCachedData.mockResolvedValue({ total: 100 })
      const fetcher = vi.fn()
      const result = await cacheAdminSales(fetcher)
      expect(result).toEqual({ total: 100 })
      expect(mockGetCachedData).toHaveBeenCalled()
    })
  })

  describe('cacheShareResolve', () => {
    it('returns cached value on hit', async () => {
      mockRedisClient.get.mockResolvedValue({ productId: 'p1' })
      const fetcher = vi.fn()
      const result = await cacheShareResolve('sharekey', fetcher)
      expect(result).toEqual({ productId: 'p1' })
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('fetches and caches on miss with non-null result', async () => {
      mockRedisClient.get.mockResolvedValue(null)
      const fetcher = vi.fn().mockResolvedValue({ productId: 'p1' })
      const result = await cacheShareResolve('sharekey', fetcher)
      expect(result).toEqual({ productId: 'p1' })
      expect(mockRedisClient.setex).toHaveBeenCalled()
    })

    it('does not cache null results', async () => {
      mockRedisClient.get.mockResolvedValue(null)
      const fetcher = vi.fn().mockResolvedValue(null)
      const result = await cacheShareResolve('sharekey', fetcher)
      expect(result).toBeNull()
      expect(mockRedisClient.setex).not.toHaveBeenCalled()
    })

    it('falls back to fetcher on error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'))
      const fetcher = vi.fn().mockResolvedValue({ productId: 'p1' })
      const result = await cacheShareResolve('sharekey', fetcher)
      expect(result).toEqual({ productId: 'p1' })
    })
  })

  describe('cacheUserSession', () => {
    it('returns cached session on hit', async () => {
      mockRedisClient.get.mockResolvedValue({ role: 'ADMIN' })
      const builder = vi.fn()
      const result = await cacheUserSession('user1', builder)
      expect(result).toEqual({ role: 'ADMIN' })
      expect(builder).not.toHaveBeenCalled()
    })

    it('builds and caches session on miss', async () => {
      mockRedisClient.get.mockResolvedValue(null)
      const builder = vi.fn().mockReturnValue({ role: 'USER' })
      const result = await cacheUserSession('user1', builder)
      expect(result).toEqual({ role: 'USER' })
      expect(mockRedisClient.setex).toHaveBeenCalled()
    })

    it('falls back to builder on error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'))
      const builder = vi.fn().mockReturnValue({ role: 'USER' })
      const result = await cacheUserSession('user1', builder)
      expect(result).toEqual({ role: 'USER' })
    })
  })

  describe('invalidateUserSessionCache', () => {
    it('invalidates session cache', async () => {
      await invalidateUserSessionCache('user1')
      expect(mockInvalidateCache).toHaveBeenCalledWith(
        CACHE_KEYS.SESSION_BY_USER('user1')
      )
    })

    it('handles errors gracefully', async () => {
      mockInvalidateCache.mockRejectedValueOnce(new Error('Redis error'))
      await invalidateUserSessionCache('user1')
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'session_cache_invalidation' })
      )
    })
  })

  describe('CACHE_KEYS dynamic functions', () => {
    it('generates correct bestsellers by limit key', () => {
      expect(CACHE_KEYS.PRODUCTS_BESTSELLERS_BY_LIMIT(10)).toBe(
        'products:bestsellers:10'
      )
    })

    it('generates correct product by id key', () => {
      expect(CACHE_KEYS.PRODUCT_BY_ID('abc')).toBe('product:abc')
    })

    it('generates correct cart by user key', () => {
      expect(CACHE_KEYS.CART_BY_USER('u1')).toBe('cart:user:u1')
    })

    it('generates correct cart by session key', () => {
      expect(CACHE_KEYS.CART_BY_SESSION('s1')).toBe('cart:session:s1')
    })

    it('generates correct admin order by id key', () => {
      expect(CACHE_KEYS.ADMIN_ORDER_BY_ID('o1')).toBe('admin:order:o1')
    })

    it('generates correct admin user by id key', () => {
      expect(CACHE_KEYS.ADMIN_USER_BY_ID('u1')).toBe('admin:user:u1')
    })

    it('generates correct exchange rates key', () => {
      expect(CACHE_KEYS.EXCHANGE_RATES_BY_DATE('2024-01-01')).toBe(
        'exchange-rates:2024-01-01'
      )
    })

    it('generates correct share resolve key', () => {
      expect(CACHE_KEYS.SHARE_RESOLVE_BY_KEY('abc')).toBe('share:abc')
    })

    it('generates correct session by user key', () => {
      expect(CACHE_KEYS.SESSION_BY_USER('u1')).toBe('session:user:u1')
    })

    it('generates correct orders user pattern', () => {
      expect(CACHE_KEYS.ORDERS_USER_PATTERN('u1')).toBe('orders:user:u1*')
    })

    it('generates correct order user pattern', () => {
      expect(CACHE_KEYS.ORDER_USER_PATTERN('u1')).toBe('order:u1:*')
    })

    it('generates correct categories all key', () => {
      expect(CACHE_KEYS.CATEGORIES_ALL).toBe('categories:all')
    })
  })
})
