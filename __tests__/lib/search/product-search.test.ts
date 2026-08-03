import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsSearchAvailable, mockSearchProducts, mockGetCachedData } =
  vi.hoisted(() => ({
    mockIsSearchAvailable: vi.fn(),
    mockSearchProducts: vi.fn(),
    mockGetCachedData: vi.fn(),
  }))

vi.mock('@/lib/search/client', () => ({
  isSearchAvailable: mockIsSearchAvailable,
  searchProducts: mockSearchProducts,
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: mockGetCachedData,
}))

import { logError } from '@/lib/logger'
import { searchProductIds, searchProductIdsCached } from '@/lib/search'

describe('lib/search/product-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSearchAvailable.mockReturnValue(true)
    mockSearchProducts.mockResolvedValue([])
    // Default: execute the fetcher so the caching wrapper is transparent.
    mockGetCachedData.mockImplementation(
      async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
        fetcher()
    )
  })

  describe('searchProductIds', () => {
    it('returns null when search is not configured so callers fall back to the DB', async () => {
      mockIsSearchAvailable.mockReturnValue(false)

      await expect(searchProductIds('shirt')).resolves.toBeNull()
      expect(mockSearchProducts).not.toHaveBeenCalled()
    })

    it('maps search hits to product ids', async () => {
      mockSearchProducts.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])

      await expect(
        searchProductIds('shirt', { limit: 5, category: 'Handbag' })
      ).resolves.toEqual(['p1', 'p2'])
      expect(mockSearchProducts).toHaveBeenCalledWith('shirt', {
        limit: 5,
        category: 'Handbag',
      })
    })

    it('logs and returns null when the search call fails', async () => {
      mockSearchProducts.mockRejectedValue(new Error('upstash down'))

      await expect(searchProductIds('shirt')).resolves.toBeNull()
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'search-service' })
      )
    })
  })

  describe('searchProductIdsCached', () => {
    it('short-circuits blank queries without touching the cache', async () => {
      await expect(searchProductIdsCached('   ')).resolves.toEqual([])
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })

    it('returns null when search is not configured', async () => {
      mockIsSearchAvailable.mockReturnValue(false)

      await expect(searchProductIdsCached('shirt')).resolves.toBeNull()
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })

    it('builds a normalized cache key from query, category and limit', async () => {
      mockSearchProducts.mockResolvedValue([{ id: 'p1' }])

      await expect(
        searchProductIdsCached('  Cotton Shirt ', {
          limit: 5,
          category: ' Handbag ',
        })
      ).resolves.toEqual(['p1'])

      expect(mockGetCachedData).toHaveBeenCalledWith(
        `search:products:${encodeURIComponent('cotton shirt')}:${encodeURIComponent('handbag')}:5`,
        60,
        expect.any(Function),
        10
      )
      expect(mockSearchProducts).toHaveBeenCalledWith('Cotton Shirt', {
        limit: 5,
        category: ' Handbag ',
      })
    })

    it('falls back to the "all" category and default limit in the cache key', async () => {
      await searchProductIdsCached('shirt')

      expect(mockGetCachedData).toHaveBeenCalledWith(
        'search:products:shirt:all:20',
        60,
        expect.any(Function),
        10
      )
    })
  })
})
