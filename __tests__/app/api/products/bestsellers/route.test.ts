import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: {
    products: {
      findBestsellers: vi.fn(),
    },
  },
}))

vi.mock('@/lib/cache', () => ({
  cacheProductsBestsellers: vi.fn(async (fetcher: () => Promise<unknown>) => {
    return await fetcher()
  }),
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

import { GET } from '@/app/api/products/bestsellers/route'
import { db } from '@/lib/db'

describe('GET /api/products/bestsellers', () => {
  const mockProducts = [
    {
      id: 'prod001',
      name: 'Best Seller 1',
      description: 'Top selling product',
      price: 199.99,
      image: 'https://example.com/img1.jpg',
      images: [],
      stock: 5,
      category: 'Flowers',
      deletedAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'prod002',
      name: 'Best Seller 2',
      description: 'Second best selling product',
      price: 99.99,
      image: 'https://example.com/img2.jpg',
      images: [],
      stock: 20,
      category: 'Handbag',
      deletedAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns bestseller products on success', async () => {
    vi.mocked(db.products.findBestsellers).mockResolvedValue(mockProducts)

    const response = await GET(
      new NextRequest('http://localhost/api/products/bestsellers')
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toEqual({ success: true, data: { products: mockProducts } })
    expect(db.products.findBestsellers).toHaveBeenCalledWith({
      limit: 5,
    })
  })

  it('accepts custom limit via query param', async () => {
    vi.mocked(db.products.findBestsellers).mockResolvedValue(mockProducts)

    const response = await GET(
      new NextRequest('http://localhost/api/products/bestsellers?limit=8')
    )

    expect(response.status).toBe(200)
    expect(db.products.findBestsellers).toHaveBeenCalledWith({
      limit: 8,
    })
  })

  it('returns 400 for invalid limit query', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/products/bestsellers?limit=0')
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({ success: false, error: 'Validation failed' })
    expect(db.products.findBestsellers).not.toHaveBeenCalled()
  })

  it('sets Cache-Control header', async () => {
    vi.mocked(db.products.findBestsellers).mockResolvedValue(mockProducts)

    const response = await GET(
      new NextRequest('http://localhost/api/products/bestsellers')
    )
    expect(response.headers.get('Cache-Control')).toBe(
      's-maxage=120, stale-while-revalidate=60'
    )
  })

  it('returns 500 on database error', async () => {
    vi.mocked(db.products.findBestsellers).mockRejectedValue(
      new Error('DB error')
    )

    const response = await GET(
      new NextRequest('http://localhost/api/products/bestsellers')
    )
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  it('returns products in the order provided by db.products.findBestsellers', async () => {
    vi.mocked(db.products.findBestsellers).mockResolvedValue(mockProducts)

    const response = await GET(
      new NextRequest('http://localhost/api/products/bestsellers')
    )
    const body = await response.json()

    expect(body.data.products[0].id).toBe('prod001')
    expect(body.data.products[1].id).toBe('prod002')
  })
})
