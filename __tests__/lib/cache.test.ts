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
  CACHE_KEYS,
  CACHE_TTL,
  buildProductsListCacheKey,
  cacheProductsList,
  cacheProductById,
  cacheProductsBestsellers,
  invalidateProductCaches,
  invalidateCartCache,
  invalidateUserOrderCaches,
  cacheAdminOrdersList,
  cacheAdminOrderById,
  invalidateAdminOrderCaches,
  cacheAdminUsersList,
  cacheAdminUserById,
  invalidateAdminUserCaches,
  cacheAdminSales,
  cacheShareResolve,
  cacheUserSession,
  invalidateUserSessionCache,
} from '@/lib/cache'
import { getCachedData, invalidateCache } from '@/lib/redis'
import { logCacheOperation, logError } from '@/lib/logger'

const mockGetCachedData = vi.mocked(getCachedData)
const mockInvalidateCache = vi.mocked(invalidateCache)
const mockLogError = vi.mocked(logError)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CACHE_KEYS', () => {
  describe('static values', () => {
    it('has correct PRODUCTS_ALL key', () => {
      expect(CACHE_KEYS.PRODUCTS_ALL).toBe('products:all')
    })

    it('has correct PRODUCTS_BESTSELLERS key', () => {
      expect(CACHE_KEYS.PRODUCTS_BESTSELLERS).toBe('products:bestsellers')
    })

    it('has correct PRODUCTS_BESTSELLERS_PATTERN key', () => {
      expect(CACHE_KEYS.PRODUCTS_BESTSELLERS_PATTERN).toBe(
        'products:bestsellers*'
      )
    })

    it('has correct PRODUCTS_PATTERN key', () => {
      expect(CACHE_KEYS.PRODUCTS_PATTERN).toBe('products:*')
    })

    it('has correct PRODUCT_PATTERN key', () => {
      expect(CACHE_KEYS.PRODUCT_PATTERN).toBe('product:*')
    })

    it('has correct CART_PATTERN key', () => {
      expect(CACHE_KEYS.CART_PATTERN).toBe('cart:*')
    })

    it('has correct ADMIN_PRODUCTS_ALL key', () => {
      expect(CACHE_KEYS.ADMIN_PRODUCTS_ALL).toBe('admin:products:all')
    })

    it('has correct ADMIN_PRODUCTS_PATTERN key', () => {
      expect(CACHE_KEYS.ADMIN_PRODUCTS_PATTERN).toBe('admin:products:*')
    })

    it('has correct ADMIN_ORDERS_ALL key', () => {
      expect(CACHE_KEYS.ADMIN_ORDERS_ALL).toBe('admin:orders:all')
    })

    it('has correct ADMIN_ORDERS_PATTERN key', () => {
      expect(CACHE_KEYS.ADMIN_ORDERS_PATTERN).toBe('admin:orders:*')
    })

    it('has correct ADMIN_USERS_ALL key', () => {
      expect(CACHE_KEYS.ADMIN_USERS_ALL).toBe('admin:users:all')
    })

    it('has correct ADMIN_USERS_PATTERN key', () => {
      expect(CACHE_KEYS.ADMIN_USERS_PATTERN).toBe('admin:users:*')
    })

    it('has correct ADMIN_SALES key', () => {
      expect(CACHE_KEYS.ADMIN_SALES).toBe('admin:sales:summary')
    })
  })

  describe('dynamic key functions', () => {
    it('PRODUCT_BY_ID returns correct key', () => {
      expect(CACHE_KEYS.PRODUCT_BY_ID('abc-123')).toBe('product:abc-123')
    })

    it('CART_BY_USER returns correct key', () => {
      expect(CACHE_KEYS.CART_BY_USER('user-1')).toBe('cart:user:user-1')
    })

    it('CART_BY_SESSION returns correct key', () => {
      expect(CACHE_KEYS.CART_BY_SESSION('sess-1')).toBe('cart:session:sess-1')
    })

    it('ORDERS_BY_USER returns correct key', () => {
      expect(CACHE_KEYS.ORDERS_BY_USER('user-1')).toBe('orders:user:user-1')
    })

    it('ORDER_BY_ID returns correct key', () => {
      expect(CACHE_KEYS.ORDER_BY_ID('user-1', 'order-1')).toBe(
        'order:user-1:order-1'
      )
    })

    it('ORDERS_USER_PATTERN returns correct key', () => {
      expect(CACHE_KEYS.ORDERS_USER_PATTERN('user-1')).toBe(
        'orders:user:user-1*'
      )
    })

    it('ORDER_USER_PATTERN returns correct key', () => {
      expect(CACHE_KEYS.ORDER_USER_PATTERN('user-1')).toBe('order:user-1:*')
    })

    it('ADMIN_ORDER_BY_ID returns correct key', () => {
      expect(CACHE_KEYS.ADMIN_ORDER_BY_ID('o1')).toBe('admin:order:o1')
    })

    it('ADMIN_USER_BY_ID returns correct key', () => {
      expect(CACHE_KEYS.ADMIN_USER_BY_ID('u1')).toBe('admin:user:u1')
    })
  })
})

describe('CACHE_TTL', () => {
  it('has correct product TTL values', () => {
    expect(CACHE_TTL.PRODUCTS_LIST).toBe(60)
    expect(CACHE_TTL.PRODUCTS_BESTSELLERS).toBe(120)
    expect(CACHE_TTL.PRODUCTS_BESTSELLERS_STALE).toBe(20)
    expect(CACHE_TTL.PRODUCT_DETAIL).toBe(300)
    expect(CACHE_TTL.STALE_TIME).toBe(10)
  })

  it('has correct cart TTL values', () => {
    expect(CACHE_TTL.CART).toBe(30)
    expect(CACHE_TTL.CART_STALE).toBe(5)
  })

  it('has correct order TTL values', () => {
    expect(CACHE_TTL.USER_ORDERS).toBe(60)
    expect(CACHE_TTL.USER_ORDERS_STALE).toBe(10)
    expect(CACHE_TTL.ORDER_DETAIL).toBe(120)
    expect(CACHE_TTL.ORDER_DETAIL_STALE).toBe(10)
  })

  it('has correct admin TTL values', () => {
    expect(CACHE_TTL.ADMIN_PRODUCTS).toBe(60)
    expect(CACHE_TTL.ADMIN_PRODUCTS_STALE).toBe(10)
    expect(CACHE_TTL.ADMIN_ORDERS).toBe(60)
    expect(CACHE_TTL.ADMIN_ORDERS_STALE).toBe(10)
    expect(CACHE_TTL.ADMIN_ORDER_DETAIL).toBe(60)
    expect(CACHE_TTL.ADMIN_ORDER_DETAIL_STALE).toBe(10)
    expect(CACHE_TTL.ADMIN_USERS).toBe(300)
    expect(CACHE_TTL.ADMIN_USERS_STALE).toBe(30)
    expect(CACHE_TTL.ADMIN_USER_DETAIL).toBe(300)
    expect(CACHE_TTL.ADMIN_USER_DETAIL_STALE).toBe(30)
    expect(CACHE_TTL.ADMIN_SALES).toBe(120)
    expect(CACHE_TTL.ADMIN_SALES_STALE).toBe(30)
  })
})

describe('buildProductsListCacheKey', () => {
  it('returns base key when no options provided', () => {
    expect(buildProductsListCacheKey()).toBe('products:all')
  })

  it('returns base key when empty options object provided', () => {
    expect(buildProductsListCacheKey({})).toBe('products:all')
  })

  it('returns empty string when search is provided', () => {
    expect(buildProductsListCacheKey({ search: 'laptop' })).toBe('')
  })

  it('builds a category-specific key when category is provided', () => {
    expect(buildProductsListCacheKey({ category: 'electronics' })).toBe(
      'products:all:category:electronics'
    )
  })

  it('returns empty string when both search and category provided', () => {
    expect(
      buildProductsListCacheKey({ search: 'laptop', category: 'electronics' })
    ).toBe('')
  })

  it('builds a paginated key for category-filtered lists', () => {
    expect(
      buildProductsListCacheKey({ category: 'electronics', limit: 12 })
    ).toBe('products:all:category:electronics:12:0')
  })

  it('builds parameterized key with limit only', () => {
    expect(buildProductsListCacheKey({ limit: 10 })).toBe('products:all:10:0')
  })

  it('builds parameterized key with offset only', () => {
    expect(buildProductsListCacheKey({ offset: 5 })).toBe('products:all:all:5')
  })

  it('builds parameterized key with limit and offset', () => {
    expect(buildProductsListCacheKey({ limit: 10, offset: 20 })).toBe(
      'products:all:10:20'
    )
  })

  it("uses 'all' for limit when undefined", () => {
    expect(buildProductsListCacheKey({ offset: 10 })).toBe(
      'products:all:all:10'
    )
  })

  it('uses 0 for offset when undefined', () => {
    expect(buildProductsListCacheKey({ limit: 5 })).toBe('products:all:5:0')
  })

  it('returns empty string when limit, offset, and search provided', () => {
    expect(
      buildProductsListCacheKey({ limit: 10, offset: 0, search: 'laptop' })
    ).toBe('')
  })
})

describe('cacheProductsList', () => {
  it('calls getCachedData with base key when no options provided', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1', name: 'Product' }])
    mockGetCachedData.mockResolvedValue([{ id: '1', name: 'Product' }])

    await cacheProductsList(fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'products:all',
      60,
      fetcher,
      10
    )
  })

  it('calls getCachedData with parameterized key when limit/offset provided', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1' }])
    mockGetCachedData.mockResolvedValue([{ id: '1' }])

    await cacheProductsList(fetcher, { limit: 10, offset: 20 })

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'products:all:10:20',
      60,
      fetcher,
      10
    )
  })

  it('skips cache and calls fetcher directly when search provided', async () => {
    const data = [{ id: '1' }]
    const fetcher = vi.fn().mockResolvedValue(data)

    const result = await cacheProductsList(fetcher, { search: 'laptop' })

    expect(result).toBe(data)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(mockGetCachedData).not.toHaveBeenCalled()
  })

  it('caches category-filtered lists with a category-specific key', async () => {
    const data = [{ id: '1' }]
    const fetcher = vi.fn().mockResolvedValue(data)
    mockGetCachedData.mockResolvedValue(data)

    const result = await cacheProductsList(fetcher, {
      category: 'electronics',
    })

    expect(result).toBe(data)
    expect(mockGetCachedData).toHaveBeenCalledWith(
      'products:all:category:electronics',
      60,
      fetcher,
      10
    )
  })

  it('returns the result from getCachedData when caching', async () => {
    const data = [{ id: '1' }]
    mockGetCachedData.mockResolvedValue(data)

    const result = await cacheProductsList(vi.fn(), { limit: 10 })

    expect(result).toBe(data)
  })
})

describe('cacheProductById', () => {
  it('calls getCachedData with correct arguments', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'p1' })
    mockGetCachedData.mockResolvedValue({ id: 'p1' })

    await cacheProductById('p1', fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'product:p1',
      300,
      fetcher,
      10
    )
  })

  it('returns the result from getCachedData', async () => {
    const data = { id: 'p1' }
    mockGetCachedData.mockResolvedValue(data)

    const result = await cacheProductById('p1', vi.fn())

    expect(result).toBe(data)
  })
})

describe('invalidateProductCaches', () => {
  it('calls invalidateCache twice without productId', async () => {
    await invalidateProductCaches()

    expect(mockInvalidateCache).toHaveBeenCalledTimes(2)
    expect(mockInvalidateCache).toHaveBeenCalledWith('products:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:products:*')
  })

  it('calls invalidateCache 3 times with productId', async () => {
    await invalidateProductCaches('p1')

    expect(mockInvalidateCache).toHaveBeenCalledTimes(3)
    expect(mockInvalidateCache).toHaveBeenCalledWith('products:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:products:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('product:p1')
  })

  it('calls logCacheOperation on success without productId', async () => {
    await invalidateProductCaches()

    expect(logCacheOperation).toHaveBeenCalledWith({
      operation: 'invalidate',
      key: 'products:*',
      success: true,
    })
  })

  it('calls logCacheOperation on success with productId', async () => {
    await invalidateProductCaches('p1')

    expect(logCacheOperation).toHaveBeenCalledWith({
      operation: 'invalidate',
      key: 'products:* and product:p1',
      success: true,
    })
  })

  it('handles errors by calling logError', async () => {
    const error = new Error('Redis down')
    mockInvalidateCache.mockRejectedValueOnce(error)

    await invalidateProductCaches()

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: 'cache_invalidation',
    })
  })
})

describe('invalidateCartCache', () => {
  it('invalidates user cart when userId provided', async () => {
    await invalidateCartCache('user-1')

    expect(mockInvalidateCache).toHaveBeenCalledTimes(1)
    expect(mockInvalidateCache).toHaveBeenCalledWith('cart:user:user-1')
  })

  it('invalidates session cart when sessionId provided', async () => {
    await invalidateCartCache(undefined, 'sess-1')

    expect(mockInvalidateCache).toHaveBeenCalledTimes(1)
    expect(mockInvalidateCache).toHaveBeenCalledWith('cart:session:sess-1')
  })

  it('invalidates both when userId and sessionId provided', async () => {
    await invalidateCartCache('user-1', 'sess-1')

    expect(mockInvalidateCache).toHaveBeenCalledTimes(2)
    expect(mockInvalidateCache).toHaveBeenCalledWith('cart:user:user-1')
    expect(mockInvalidateCache).toHaveBeenCalledWith('cart:session:sess-1')
  })

  it('does not call invalidateCache when neither provided', async () => {
    await invalidateCartCache()

    expect(mockInvalidateCache).not.toHaveBeenCalled()
  })

  it('handles errors by calling logError', async () => {
    const error = new Error('Redis down')
    mockInvalidateCache.mockRejectedValueOnce(error)

    await invalidateCartCache('user-1')

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: 'cart_cache_invalidation',
    })
  })
})

describe('invalidateUserOrderCaches', () => {
  it('calls invalidateCache twice with correct patterns', async () => {
    await invalidateUserOrderCaches('user-1')

    expect(mockInvalidateCache).toHaveBeenCalledTimes(2)
    expect(mockInvalidateCache).toHaveBeenCalledWith('orders:user:user-1')
    expect(mockInvalidateCache).toHaveBeenCalledWith('order:user-1:*')
  })

  it('handles errors by calling logError', async () => {
    const error = new Error('Redis down')
    mockInvalidateCache.mockRejectedValueOnce(error)

    await invalidateUserOrderCaches('user-1')

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: 'order_cache_invalidation',
    })
  })
})

describe('cacheProductsBestsellers', () => {
  it('calls getCachedData with correct arguments', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1', name: 'Product' }])
    mockGetCachedData.mockResolvedValue([{ id: '1', name: 'Product' }])

    await cacheProductsBestsellers(fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'products:bestsellers',
      120,
      fetcher,
      20
    )
  })

  it('uses a limit-specific cache key when limit differs from default', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: '1', name: 'Product' }])
    mockGetCachedData.mockResolvedValue([{ id: '1', name: 'Product' }])

    await cacheProductsBestsellers(fetcher, 12)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'products:bestsellers:12',
      120,
      fetcher,
      20
    )
  })

  it('returns the result from getCachedData', async () => {
    const data = [{ id: '1' }]
    mockGetCachedData.mockResolvedValue(data)

    const result = await cacheProductsBestsellers(vi.fn())

    expect(result).toBe(data)
  })
})

describe('cacheAdminOrdersList', () => {
  it('calls getCachedData with correct arguments', async () => {
    const fetcher = vi.fn().mockResolvedValue([])
    mockGetCachedData.mockResolvedValue([])

    await cacheAdminOrdersList(fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'admin:orders:all',
      60,
      fetcher,
      10
    )
  })
})

describe('cacheAdminOrderById', () => {
  it('calls getCachedData with correct arguments', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'o1' })
    mockGetCachedData.mockResolvedValue({ id: 'o1' })

    await cacheAdminOrderById('o1', fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'admin:order:o1',
      60,
      fetcher,
      10
    )
  })
})

describe('invalidateAdminOrderCaches', () => {
  it('invalidates admin orders pattern and specific order without userId', async () => {
    await invalidateAdminOrderCaches('o1')

    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:orders:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:order:o1')
    expect(mockInvalidateCache).toHaveBeenCalledWith('products:bestsellers*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:sales:*')
  })

  it('also invalidates user order caches when userId provided', async () => {
    await invalidateAdminOrderCaches('o1', 'u1')

    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:orders:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:order:o1')
    expect(mockInvalidateCache).toHaveBeenCalledWith('products:bestsellers*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:sales:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('orders:user:u1')
    expect(mockInvalidateCache).toHaveBeenCalledWith('order:u1:*')
  })

  it('handles errors by calling logError', async () => {
    const error = new Error('Redis down')
    mockInvalidateCache.mockRejectedValueOnce(error)

    await invalidateAdminOrderCaches('o1')

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: 'admin_order_cache_invalidation',
    })
  })
})

describe('cacheAdminUsersList', () => {
  it('calls getCachedData with correct arguments', async () => {
    const fetcher = vi.fn().mockResolvedValue([])
    mockGetCachedData.mockResolvedValue([])

    await cacheAdminUsersList(fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'admin:users:all',
      300,
      fetcher,
      30
    )
  })
})

describe('cacheAdminUserById', () => {
  it('calls getCachedData with correct arguments', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'u1' })
    mockGetCachedData.mockResolvedValue({ id: 'u1' })

    await cacheAdminUserById('u1', fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'admin:user:u1',
      300,
      fetcher,
      30
    )
  })
})

describe('invalidateAdminUserCaches', () => {
  it('invalidates admin users pattern and specific user', async () => {
    await invalidateAdminUserCaches('u1')

    expect(mockInvalidateCache).toHaveBeenCalledTimes(2)
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:users:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:user:u1')
  })

  it('handles errors by calling logError', async () => {
    const error = new Error('Redis down')
    mockInvalidateCache.mockRejectedValueOnce(error)

    await invalidateAdminUserCaches('u1')

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: 'admin_user_cache_invalidation',
    })
  })
})

describe('cacheAdminSales', () => {
  it('calls getCachedData with correct arguments', async () => {
    const fetcher = vi.fn().mockResolvedValue({ totalRevenue: 1000 })
    mockGetCachedData.mockResolvedValue({ totalRevenue: 1000 })

    await cacheAdminSales(fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      'admin:sales:summary',
      120,
      fetcher,
      30
    )
  })
})

describe('CACHE_KEYS share', () => {
  it('SHARE_RESOLVE_BY_KEY returns correct key', () => {
    expect(CACHE_KEYS.SHARE_RESOLVE_BY_KEY('abc1234')).toBe('share:abc1234')
  })
})

describe('CACHE_KEYS session', () => {
  it('SESSION_BY_USER returns correct key', () => {
    expect(CACHE_KEYS.SESSION_BY_USER('user-123')).toBe('session:user:user-123')
  })
})

describe('CACHE_TTL share', () => {
  it('has correct SHARE_RESOLVE TTL of 1 year in seconds', () => {
    expect(CACHE_TTL.SHARE_RESOLVE).toBe(31536000)
  })
})

describe('CACHE_TTL session', () => {
  it('has correct SESSION TTL of 5 minutes in seconds', () => {
    expect(CACHE_TTL.SESSION).toBe(300)
  })
})

describe('cacheShareResolve', () => {
  beforeEach(() => {
    mockRedisClient.get.mockReset()
    mockRedisClient.setex.mockReset()
  })

  it('returns cached value and skips fetcher on cache hit', async () => {
    const shareData = { productId: 'prd1234', variationId: 'var5678' }
    mockRedisClient.get.mockResolvedValue(shareData)
    const fetcher = vi.fn()

    const result = await cacheShareResolve('shr1234', fetcher)

    expect(result).toEqual(shareData)
    expect(fetcher).not.toHaveBeenCalled()
    expect(mockRedisClient.get).toHaveBeenCalledWith('share:shr1234')
    expect(mockRedisClient.setex).not.toHaveBeenCalled()
  })

  it('fetches, caches with 1-year TTL, and returns non-null result on cache miss', async () => {
    const shareData = { productId: 'prd1234', variationId: null }
    mockRedisClient.get.mockResolvedValue(null)
    mockRedisClient.setex.mockResolvedValue('OK')
    const fetcher = vi.fn().mockResolvedValue(shareData)

    const result = await cacheShareResolve('shr1234', fetcher)

    expect(result).toEqual(shareData)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      'share:shr1234',
      31536000,
      shareData
    )
  })

  it('does NOT cache null results to prevent cache-poisoning', async () => {
    mockRedisClient.get.mockResolvedValue(null)
    const fetcher = vi.fn().mockResolvedValue(null)

    const result = await cacheShareResolve('notexist', fetcher)

    expect(result).toBeNull()
    expect(fetcher).toHaveBeenCalledOnce()
    expect(mockRedisClient.setex).not.toHaveBeenCalled()
  })

  it('falls back to fetcher when Redis throws', async () => {
    const shareData = { productId: 'prd1234', variationId: null }
    mockRedisClient.get.mockRejectedValue(new Error('Redis down'))
    const fetcher = vi.fn().mockResolvedValue(shareData)

    const result = await cacheShareResolve('shr1234', fetcher)

    expect(result).toEqual(shareData)
    expect(fetcher).toHaveBeenCalledOnce()
  })
})

describe('cacheUserSession', () => {
  beforeEach(() => {
    mockRedisClient.get.mockReset()
    mockRedisClient.setex.mockReset()
  })

  it('returns cached value without calling builder on cache hit', async () => {
    const userData = { id: 'u1', role: 'CUSTOMER', phoneNumber: undefined }
    mockRedisClient.get.mockResolvedValue(userData)
    const builder = vi.fn()

    const result = await cacheUserSession('u1', builder)

    expect(result).toEqual(userData)
    expect(builder).not.toHaveBeenCalled()
    expect(mockRedisClient.get).toHaveBeenCalledWith('session:user:u1')
    expect(mockRedisClient.setex).not.toHaveBeenCalled()
  })

  it('calls builder, caches with SESSION TTL, and returns result on cache miss', async () => {
    const userData = { id: 'u1', role: 'ADMIN', phoneNumber: '+1234567890' }
    mockRedisClient.get.mockResolvedValue(null)
    mockRedisClient.setex.mockResolvedValue('OK')
    const builder = vi.fn().mockReturnValue(userData)

    const result = await cacheUserSession('u1', builder)

    expect(result).toEqual(userData)
    expect(builder).toHaveBeenCalledOnce()
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      'session:user:u1',
      300,
      userData
    )
  })

  it('falls back to builder when Redis throws', async () => {
    const userData = { id: 'u2', role: 'CUSTOMER' }
    mockRedisClient.get.mockRejectedValue(new Error('Redis down'))
    const builder = vi.fn().mockReturnValue(userData)

    const result = await cacheUserSession('u2', builder)

    expect(result).toEqual(userData)
    expect(builder).toHaveBeenCalledOnce()
    expect(mockRedisClient.setex).not.toHaveBeenCalled()
  })

  it('calls builder directly when Redis is unavailable', async () => {
    const { getRedisClient } = await import('@/lib/redis')
    vi.mocked(getRedisClient).mockReturnValueOnce(null)

    const userData = { id: 'u3', role: 'CUSTOMER' }
    const builder = vi.fn().mockReturnValue(userData)

    const result = await cacheUserSession('u3', builder)

    expect(result).toEqual(userData)
    expect(builder).toHaveBeenCalledOnce()
    expect(mockRedisClient.get).not.toHaveBeenCalled()
  })
})

describe('invalidateUserSessionCache', () => {
  it('calls invalidateCache with the correct session key', async () => {
    await invalidateUserSessionCache('user-123')

    expect(mockInvalidateCache).toHaveBeenCalledWith('session:user:user-123')
  })

  it('handles errors by calling logError', async () => {
    const error = new Error('Redis down')
    mockInvalidateCache.mockRejectedValueOnce(error)

    await invalidateUserSessionCache('user-123')

    expect(mockLogError).toHaveBeenCalledWith({
      error,
      context: 'session_cache_invalidation',
    })
  })
})
