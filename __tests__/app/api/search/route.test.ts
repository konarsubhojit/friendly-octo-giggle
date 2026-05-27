import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSearchCatalog } = vi.hoisted(() => ({
  mockSearchCatalog: vi.fn(),
}))

vi.mock('@/lib/search-discovery', () => ({
  SEARCH_SORT_VALUES: [
    'relevance',
    'price_asc',
    'price_desc',
    'newest',
    'best_selling',
    'top_rated',
  ],
  SEARCH_VARIANT_VALUES: ['all', 'single', 'multiple'],
  searchCatalog: mockSearchCatalog,
}))

import { GET } from '@/app/api/search/route'

describe('search API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchCatalog.mockResolvedValue({
      query: 'test',
      results: [],
      total: 0,
      facets: {
        categories: [],
        price: { min: 0, max: 0 },
        stock: { inStock: 0, outOfStock: 0 },
        ratings: { gte4: 0, gte3: 0, lt3: 0 },
        variants: { single: 0, multiple: 0 },
      },
      sort: 'relevance',
      fallbackUsed: false,
      suggestions: [],
      trending: [],
    })
  })

  describe('GET', () => {
    it('returns 400 for missing query', async () => {
      const request = new NextRequest('http://localhost/api/search')

      const response = await GET(request)

      expect(response.status).toBe(400)
    })

    it('returns search results with facets', async () => {
      mockSearchCatalog.mockResolvedValue({
        query: 'cotton shirt',
        results: [{ id: 'p1', name: 'Cotton Shirt' }],
        total: 1,
        facets: {
          categories: [{ value: 'Clothing', count: 1 }],
          price: { min: 99, max: 99 },
          stock: { inStock: 1, outOfStock: 0 },
          ratings: { gte4: 1, gte3: 1, lt3: 0 },
          variants: { single: 1, multiple: 0 },
        },
        sort: 'relevance',
        fallbackUsed: false,
        suggestions: [],
        trending: [],
      })

      const request = new NextRequest(
        'http://localhost/api/search?q=cotton+shirt'
      )

      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.results).toHaveLength(1)
      expect(body.data.query).toBe('cotton shirt')
      expect(body.data.facets.categories[0]).toEqual({
        value: 'Clothing',
        count: 1,
      })
    })

    it('passes filter and sort params to catalog search', async () => {
      const request = new NextRequest(
        'http://localhost/api/search?q=test&category=Clothing&limit=10&offset=5&sort=price_desc&minPrice=100&maxPrice=200&inStock=true&minRating=4&variant=multiple'
      )

      await GET(request)

      expect(mockSearchCatalog).toHaveBeenCalledWith({
        q: 'test',
        category: 'Clothing',
        limit: 10,
        offset: 5,
        sort: 'price_desc',
        minPrice: 100,
        maxPrice: 200,
        inStock: true,
        minRating: 4,
        variant: 'multiple',
      })
    })

    it('includes cache headers', async () => {
      const request = new NextRequest('http://localhost/api/search?q=test')

      const response = await GET(request)

      expect(response.headers.get('Cache-Control')).toContain('s-maxage=30')
    })

    it('handles search errors', async () => {
      mockSearchCatalog.mockRejectedValue(new Error('Search failure'))

      const request = new NextRequest('http://localhost/api/search?q=test')

      const response = await GET(request)

      expect(response.status).toBe(500)
    })
  })
})
