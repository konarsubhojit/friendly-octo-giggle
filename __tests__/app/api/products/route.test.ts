import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSearchCatalog, mockCacheProductsList } = vi.hoisted(() => ({
  mockSearchCatalog: vi.fn(),
  mockCacheProductsList: vi.fn(
    async (fetcher: () => Promise<unknown>, _options?: unknown) => {
      return await fetcher()
    }
  ),
}))

vi.mock('@/lib/cache', () => ({
  cacheProductsList: mockCacheProductsList,
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

vi.mock('@/lib/api-middleware', () => ({
  withLogging: (fn: unknown) => fn,
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
}))

import { GET } from '@/app/api/products/route'

describe('GET /api/products', () => {
  const mockProducts = [
    {
      id: 'prod001',
      name: 'Test Product 1',
      description: 'A test product',
      price: 99.99,
      image: 'https://example.com/img1.jpg',
      stock: 10,
      soldCount: 0,
      category: 'electronics',
    },
    {
      id: 'prod002',
      name: 'Test Product 2',
      description: 'Another test product',
      price: 149.99,
      image: 'https://example.com/img2.jpg',
      stock: 5,
      soldCount: 0,
      category: 'electronics',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchCatalog.mockResolvedValue({
      results: mockProducts,
      total: mockProducts.length,
    })
  })

  it('returns products on success', async () => {
    const response = await GET(new NextRequest('http://localhost/api/products'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toEqual({
      success: true,
      data: { products: mockProducts, hasMore: false },
    })
    expect(mockSearchCatalog).toHaveBeenCalledOnce()
  })

  it('sets Cache-Control header', async () => {
    const response = await GET(new NextRequest('http://localhost/api/products'))
    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=120'
    )
  })

  it('returns 500 on error', async () => {
    mockSearchCatalog.mockRejectedValue(new Error('Search error'))

    const response = await GET(new NextRequest('http://localhost/api/products'))
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  it('passes filters and sort to catalog search', async () => {
    await GET(
      new NextRequest(
        'http://localhost/api/products?q=flowers&category=Flowers&sort=price_desc&minPrice=10&maxPrice=120&inStock=true&minRating=4&variant=multiple&limit=5&offset=2'
      )
    )

    expect(mockSearchCatalog).toHaveBeenCalledWith({
      q: 'flowers',
      category: 'Flowers',
      sort: 'price_desc',
      minPrice: 10,
      maxPrice: 120,
      inStock: true,
      minRating: 4,
      variant: 'multiple',
      limit: 6,
      offset: 2,
    })
  })

  it('reports hasMore when total exceeds current page window', async () => {
    mockSearchCatalog.mockResolvedValue({
      results: mockProducts,
      total: 10,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/products?limit=2&offset=2')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      success: true,
      data: { products: mockProducts.slice(0, 2), hasMore: true },
    })
  })
})
