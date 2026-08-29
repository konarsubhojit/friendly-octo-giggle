import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockIndex, mockSearch, mockDelete, mockRedis } = vi.hoisted(() => {
  const hoistedSearch = vi.fn().mockResolvedValue([])
  const hoistedDelete = vi.fn().mockResolvedValue({ deleted: 1 })
  const hoistedRedis = {
    get: vi.fn(),
    setex: vi.fn(),
  }
  return {
    mockIndex: vi.fn(() => ({
      search: hoistedSearch,
      delete: hoistedDelete,
      upsert: vi.fn(),
      reset: vi.fn(),
      info: vi.fn(),
    })),
    mockSearch: hoistedSearch,
    mockDelete: hoistedDelete,
    mockRedis: hoistedRedis,
  }
})

vi.mock('@upstash/search', () => ({
  Search: vi.fn().mockImplementation(function () {
    return { index: mockIndex }
  }),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logCacheOperation: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => mockRedis,
}))

import { logError, logCacheOperation } from '@/lib/logger'
import {
  __resetCatalogSearchClientForTests,
  getIndexInfo,
  removeProduct,
  resetIndex,
  searchProducts,
} from '@/lib/search'
import { __resetProviderResolutionForTests } from '@/lib/providers/resolution'

const SEARCH_HIT = {
  id: 'p1',
  score: 0.9,
  content: { name: 'Shirt', description: 'Soft', category: 'Clothing' },
  metadata: { image: 'https://example.com/shirt.jpg' },
}

describe('lib/search/client caching and failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.UPSTASH_SEARCH_REST_URL = 'https://test.upstash.io'
    process.env.UPSTASH_SEARCH_REST_TOKEN = 'test-token'
    process.env.SEARCH_PROVIDER = 'upstash'
    __resetProviderResolutionForTests()
    __resetCatalogSearchClientForTests()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.setex.mockResolvedValue('OK')
    mockSearch.mockResolvedValue([])
  })

  afterEach(() => {
    delete process.env.UPSTASH_SEARCH_REST_URL
    delete process.env.UPSTASH_SEARCH_REST_TOKEN
  })

  it('returns cached results without querying Upstash on a cache hit', async () => {
    mockRedis.get.mockResolvedValue([SEARCH_HIT])

    await expect(searchProducts('Shirt')).resolves.toEqual([SEARCH_HIT])
    expect(mockSearch).not.toHaveBeenCalled()
    expect(logCacheOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'hit' })
    )
  })

  it('caches results on a cache miss using a normalized key', async () => {
    mockSearch.mockResolvedValue([SEARCH_HIT])

    await expect(
      searchProducts('  Cotton   Shirt ', { limit: 5, category: 'Clothing' })
    ).resolves.toEqual([SEARCH_HIT])

    expect(logCacheOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'miss' })
    )
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'search:products:cotton shirt:cat:Clothing:l:5',
      60,
      [SEARCH_HIT]
    )
  })

  it('defaults missing result metadata to an empty image', async () => {
    mockSearch.mockResolvedValue([{ ...SEARCH_HIT, metadata: undefined }])

    const results = await searchProducts('shirt')

    expect(results[0].metadata).toEqual({ image: '' })
  })

  it('still returns results when the cache read fails', async () => {
    mockRedis.get.mockRejectedValue(new Error('redis get failed'))
    mockSearch.mockResolvedValue([SEARCH_HIT])

    await expect(searchProducts('shirt')).resolves.toEqual([SEARCH_HIT])
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalInfo: expect.objectContaining({
          operation: 'searchProducts:cacheGet',
        }),
      })
    )
  })

  it('still returns results when the cache write fails', async () => {
    mockRedis.setex.mockRejectedValue(new Error('redis set failed'))
    mockSearch.mockResolvedValue([SEARCH_HIT])

    await expect(searchProducts('shirt')).resolves.toEqual([SEARCH_HIT])
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalInfo: expect.objectContaining({
          operation: 'searchProducts:cacheSet',
        }),
      })
    )
  })

  it('swallows and logs delete failures in removeProduct', async () => {
    mockDelete.mockRejectedValue(new Error('delete failed'))

    await expect(removeProduct('p1')).resolves.toBeUndefined()
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalInfo: expect.objectContaining({ operation: 'removeProduct' }),
      })
    )
  })

  it('is a no-op for removeProduct and resetIndex when search is unavailable', async () => {
    delete process.env.UPSTASH_SEARCH_REST_URL
    delete process.env.UPSTASH_SEARCH_REST_TOKEN

    await expect(removeProduct('p1')).resolves.toBeUndefined()
    await expect(resetIndex('products')).resolves.toBeUndefined()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('throws from getIndexInfo when search is unavailable', async () => {
    delete process.env.UPSTASH_SEARCH_REST_URL
    delete process.env.UPSTASH_SEARCH_REST_TOKEN

    await expect(getIndexInfo('products')).rejects.toThrow(
      'Search is not configured'
    )
  })
})
