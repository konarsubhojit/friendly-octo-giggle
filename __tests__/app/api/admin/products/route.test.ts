import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/admin/products/route'

const { mockFindMany, mockCreate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
}))
const mockSelectWhere = vi.hoisted(() => vi.fn())
const mockSelectFrom = vi.hoisted(() =>
  vi.fn(() => ({ where: mockSelectWhere }))
)
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: { findMany: mockFindMany },
    },
    select: mockSelect,
  },
  db: {
    products: {
      create: mockCreate,
    },
  },
}))

vi.mock('@/lib/schema', () => ({
  products: {
    id: 'id',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
    name: 'name',
  },
}))

vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
  desc: vi.fn((col) => col),
  lt: vi.fn(),
  ilike: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  SQL: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/cache', () => ({
  invalidateProductCaches: vi.fn(),
  cacheAdminProductsList: vi.fn((fetcher: () => Promise<unknown>) => fetcher()),
}))

vi.mock('@/lib/search', () => ({
  searchProductIds: vi.fn().mockResolvedValue(null),
  indexProduct: vi.fn(),
}))

vi.mock(
  '@/lib/validations',
  async () => await vi.importActual('@/lib/validations')
)

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateProductCaches } from '@/lib/cache'
import { revalidateTag } from 'next/cache'

const makeRequest = (params?: Record<string, string>) => {
  const url = new URL('http://localhost/api/admin/products')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url)
}

describe('Admin Products API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectWhere.mockResolvedValue([{ value: 0 }])
  })

  describe('GET /api/admin/products', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as never)
      const response = await GET(makeRequest())
      const data = await response.json()
      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Not authenticated')
    })

    it('returns 403 when not admin', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'CUSTOMER' },
        expires: new Date().toISOString(),
      } as never)
      const response = await GET(makeRequest())
      const data = await response.json()
      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Not authorized - Admin access required')
    })

    it('returns products on success', async () => {
      const mockProducts = [
        {
          id: 'prod1',
          name: 'Product 1',
          price: 19.99,
          deletedAt: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          variations: [],
        },
      ]
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'ADMIN' },
        expires: new Date().toISOString(),
      } as never)
      mockFindMany.mockResolvedValue(mockProducts)
      mockSelectWhere.mockResolvedValue([{ value: 1 }])

      const response = await GET(makeRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.products).toHaveLength(1)
      expect(data.data).toHaveProperty('hasMore')
      expect(data.data).toHaveProperty('nextCursor')
      expect(data.data.totalCount).toBe(1)
    })

    it('handles pagination with cursor', async () => {
      const mockProducts = [
        {
          id: 'prod2',
          name: 'Product 2',
          price: 29.99,
          deletedAt: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          variations: [],
        },
      ]
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'ADMIN' },
        expires: new Date().toISOString(),
      } as never)
      mockFindMany.mockResolvedValue(mockProducts)
      mockSelectWhere.mockResolvedValue([{ value: 1 }])

      const response = await GET(
        makeRequest({ cursor: '2024-01-01T00:00:00.000Z' })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('handles pagination with offset', async () => {
      const mockProducts = [
        {
          id: 'prod3',
          name: 'Product 3',
          price: 39.99,
          deletedAt: null,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
          variations: [],
        },
      ]
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'ADMIN' },
        expires: new Date().toISOString(),
      } as never)
      mockFindMany.mockResolvedValue(mockProducts)
      mockSelectWhere.mockResolvedValue([{ value: 1 }])

      const response = await GET(makeRequest({ offset: '10' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('handles search with empty results', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'ADMIN' },
        expires: new Date().toISOString(),
      } as never)
      mockFindMany.mockResolvedValue([])
      mockSelectWhere.mockResolvedValue([{ value: 0 }])

      const response = await GET(makeRequest({ search: 'nonexistent' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.products).toHaveLength(0)
    })

    it('enforces limit constraints', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'ADMIN' },
        expires: new Date().toISOString(),
      } as never)
      mockFindMany.mockResolvedValue([])
      mockSelectWhere.mockResolvedValue([{ value: 0 }])

      // Test max limit
      const response = await GET(makeRequest({ limit: '200' }))
      expect(response.status).toBe(200)

      // Test min limit
      const response2 = await GET(makeRequest({ limit: '0' }))
      expect(response2.status).toBe(200)
    })
  })

  describe('POST /api/admin/products', () => {
    const validProductInput = {
      name: 'Test Product',
      price: 29.99,
      stock: 100,
      category: 'Electronics',
      description: 'Test desc',
      image: 'https://example.com/img.png',
    }

    const createPostRequest = (body: unknown) =>
      new NextRequest('http://localhost/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(body),
      })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as never)
      const request = createPostRequest(validProductInput)
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Not authenticated')
    })

    it('returns 403 when not admin', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'CUSTOMER' },
        expires: new Date().toISOString(),
      } as never)
      const request = createPostRequest(validProductInput)
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Not authorized - Admin access required')
    })

    it('returns 400 for invalid input (Zod validation)', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'ADMIN' },
        expires: new Date().toISOString(),
      } as never)
      const invalidInput = { name: '', price: -10, stock: -5 }
      const request = createPostRequest(invalidInput)
      const response = await POST(request)
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    it('creates product successfully (201)', async () => {
      const mockCreatedProduct = {
        id: 'newprod1',
        ...validProductInput,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      vi.mocked(auth).mockResolvedValue({
        user: { role: 'ADMIN' },
        expires: new Date().toISOString(),
      } as never)
      mockCreate.mockResolvedValue(mockCreatedProduct)
      vi.mocked(invalidateProductCaches).mockResolvedValue()

      const request = createPostRequest(validProductInput)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.product).toEqual(mockCreatedProduct)
      expect(db.products.create).toHaveBeenCalledWith({
        ...validProductInput,
        images: [],
      })
      expect(revalidateTag).toHaveBeenCalledWith('products', {})
      expect(invalidateProductCaches).toHaveBeenCalled()
    })
  })
})
