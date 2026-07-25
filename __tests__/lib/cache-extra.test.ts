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
  buildPublicCacheHeader,
  buildAdminOrdersCacheKey,
  cacheAdminOrdersList,
  cacheCategoriesList,
  cacheProductSoldCounts,
  invalidateProductCaches,
  invalidateCartCache,
} from '@/lib/cache'
import { getCachedData, invalidateCache } from '@/lib/redis'

const mockGetCachedData = vi.mocked(getCachedData)
const mockInvalidateCache = vi.mocked(invalidateCache)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCachedData.mockImplementation(async (_key, _ttl, fetcher) =>
    (fetcher as () => Promise<unknown>)()
  )
  mockInvalidateCache.mockResolvedValue(undefined as never)
})

describe('CACHE_KEYS builders', () => {
  it('builds bestseller and sold-count keys', () => {
    expect(CACHE_KEYS.PRODUCTS_BESTSELLERS_BY_LIMIT(5)).toBe(
      'products:bestsellers:5'
    )
    expect(CACHE_KEYS.PRODUCT_SOLD_COUNTS('abc')).toBe(
      'products:sold-count:abc'
    )
    expect(CACHE_KEYS.PINCODE_LOOKUP('110001')).toBe('pincode:110001')
    expect(CACHE_KEYS.EXCHANGE_RATES_BY_DATE('2025-01-01')).toBe(
      'exchange-rates:2025-01-01'
    )
  })
})

describe('buildPublicCacheHeader', () => {
  it('derives a stale window from the max age', () => {
    expect(buildPublicCacheHeader(60)).toBe(
      'public, s-maxage=60, stale-while-revalidate=30'
    )
  })

  it('never returns a zero stale window', () => {
    expect(buildPublicCacheHeader(1)).toContain('stale-while-revalidate=1')
  })

  it('honours an explicit stale window', () => {
    expect(buildPublicCacheHeader(60, 5)).toBe(
      'public, s-maxage=60, stale-while-revalidate=5'
    )
  })
})

describe('buildAdminOrdersCacheKey', () => {
  it('returns an empty key for search queries', () => {
    expect(buildAdminOrdersCacheKey({ search: 'jane' })).toBe('')
  })

  it('ignores the ALL status filter', () => {
    expect(buildAdminOrdersCacheKey({ status: 'ALL' })).toBe(
      CACHE_KEYS.ADMIN_ORDERS_ALL
    )
  })

  it('includes status, cursor and limit', () => {
    const key = buildAdminOrdersCacheKey({
      status: 'PENDING',
      cursor: 'cur1',
      limit: 20,
    })
    expect(key).toContain('s:PENDING')
    expect(key).toContain('c:cur1')
    expect(key).toContain('l:20')
  })

  it('falls back to the offset when there is no cursor', () => {
    expect(buildAdminOrdersCacheKey({ offset: 40 })).toContain('o:40')
  })
})

describe('cacheAdminOrdersList', () => {
  it('uses the default key when no params are given', async () => {
    const fetcher = vi.fn().mockResolvedValue(['order'])

    await cacheAdminOrdersList(fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      CACHE_KEYS.ADMIN_ORDERS_ALL,
      expect.any(Number),
      fetcher,
      expect.any(Number)
    )
  })

  it('bypasses the cache for search queries', async () => {
    const fetcher = vi.fn().mockResolvedValue(['order'])

    await cacheAdminOrdersList(fetcher, { search: 'jane' })

    expect(mockGetCachedData).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalled()
  })
})

describe('cacheCategoriesList', () => {
  it('caches under the categories key', async () => {
    const fetcher = vi.fn().mockResolvedValue(['Flowers'])

    await cacheCategoriesList(fetcher)

    expect(mockGetCachedData).toHaveBeenCalledWith(
      CACHE_KEYS.CATEGORIES_ALL,
      expect.any(Number),
      fetcher,
      expect.any(Number)
    )
  })
})

describe('cacheProductSoldCounts', () => {
  it('bypasses the cache when there are no product ids', async () => {
    const fetcher = vi.fn().mockResolvedValue({})

    await cacheProductSoldCounts([], fetcher)

    expect(mockGetCachedData).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalled()
  })

  it('produces a stable hash regardless of id order or duplicates', async () => {
    const fetcher = vi.fn().mockResolvedValue({})

    await cacheProductSoldCounts(['b', 'a'], fetcher)
    await cacheProductSoldCounts(['a', 'b', 'a'], fetcher)

    const firstKey = mockGetCachedData.mock.calls[0][0]
    const secondKey = mockGetCachedData.mock.calls[1][0]
    expect(firstKey).toBe(secondKey)
  })

  it('produces different hashes for different id sets', async () => {
    const fetcher = vi.fn().mockResolvedValue({})

    await cacheProductSoldCounts(['a'], fetcher)
    await cacheProductSoldCounts(['b'], fetcher)

    expect(mockGetCachedData.mock.calls[0][0]).not.toBe(
      mockGetCachedData.mock.calls[1][0]
    )
  })
})

describe('cache invalidation normalization', () => {
  it('accepts a single product id', async () => {
    await invalidateProductCaches('p1')
    expect(mockInvalidateCache).toHaveBeenCalled()
  })

  it('accepts an array of product ids', async () => {
    await invalidateProductCaches(['p1', 'p2'])
    expect(mockInvalidateCache).toHaveBeenCalled()
  })

  it('accepts no product ids', async () => {
    await invalidateProductCaches()
    expect(mockInvalidateCache).toHaveBeenCalled()
  })

  it('accepts nullable cart identifiers', async () => {
    await invalidateCartCache('u1', 's1')
    await invalidateCartCache(undefined, undefined)
    expect(mockInvalidateCache).toHaveBeenCalled()
  })
})
