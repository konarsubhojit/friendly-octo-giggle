import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCheckAdminAuth,
  mockInvalidateProductCaches,
  mockRevalidateTag,
  mockFindFirst,
  mockUpdate,
  mockReturning,
} = vi.hoisted(() => ({
  mockCheckAdminAuth: vi.fn(async () => ({ authorized: true })),
  mockInvalidateProductCaches: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockReturning: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      productVariations: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args)
      return {
        set: (setArgs: unknown) => ({
          where: (whereArgs: unknown) => ({
            returning: () => mockReturning(),
          }),
        }),
      }
    },
  },
}))

vi.mock('@/lib/schema', () => ({
  products: { id: 'id', deletedAt: 'deletedAt' },
  productVariations: {
    id: 'id',
    productId: 'productId',
    name: 'name',
    styleId: 'styleId',
    deletedAt: 'deletedAt',
    variationType: 'variationType',
    price: 'price',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}))

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))

vi.mock('@/lib/cache', () => ({
  invalidateProductCaches: mockInvalidateProductCaches,
}))

vi.mock('next/cache', () => ({
  revalidateTag: mockRevalidateTag,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  isNull: vi.fn((field: unknown) => ({ op: 'isNull', field })),
  ne: vi.fn((...args: unknown[]) => ({ op: 'ne', args })),
}))

import { PUT, DELETE } from '@/app/api/admin/variations/[variationId]/route'

const mockVariation = {
  id: 'var123',
  productId: 'prod123',
  styleId: null,
  name: 'Blue',
  designName: 'Classic',
  image: null,
  images: [],
  price: 100,
  stock: 10,
  variationType: 'colour' as const,
  deletedAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

const mockProduct = {
  id: 'prod123',
  name: 'Test Product',
  deletedAt: null,
}

describe('PUT /api/admin/variations/[variationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindFirst.mockResolvedValue(null)
  })

  it('returns 401 when not authenticated as admin', async () => {
    mockCheckAdminAuth.mockResolvedValueOnce({
      authorized: false,
      status: 401,
      error: 'Unauthorized',
    })

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Red' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when variation not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Red' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Variation not found')
  })

  it('returns 404 when product not found', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Red' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Product not found')
  })

  it('returns validation error for invalid data', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ price: 'invalid' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Expected number')
  })

  it('returns 400 when no fields to update', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({}),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('No fields to update')
  })

  it('returns 400 for colour with price <= 0', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ price: 0 }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Colour price must be greater than zero')
  })

  it('returns 404 when parent style not found', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)
      .mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ styleId: 'style999' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe(
      'Parent style not found or does not belong to this product'
    )
  })

  it('returns 409 when name conflicts with existing variation', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)
      .mockResolvedValueOnce({ id: 'other-var', name: 'Red', deletedAt: null })

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Red' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBe(
      'A variation with this name already exists for this product'
    )
  })

  it('returns 409 when name conflicts with archived variation', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)
      .mockResolvedValueOnce({
        id: 'other-var',
        name: 'Red',
        deletedAt: new Date(),
      })

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Red' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('previously archived')
  })

  it('successfully updates variation', async () => {
    const updatedVariation = {
      ...mockVariation,
      name: 'Red',
      updatedAt: new Date(),
    }
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)
      .mockResolvedValueOnce(null)
    mockReturning.mockResolvedValueOnce([updatedVariation])

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Red', stock: 20 }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.variation.name).toBe('Red')
  })

  it('allows updating to the same name', async () => {
    const updatedVariation = {
      ...mockVariation,
      stock: 20,
      updatedAt: new Date(),
    }
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)
    mockReturning.mockResolvedValueOnce([updatedVariation])

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Blue', stock: 20 }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})

describe('DELETE /api/admin/variations/[variationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindFirst.mockResolvedValue(null)
  })

  it('returns 401 when not authenticated as admin', async () => {
    mockCheckAdminAuth.mockResolvedValueOnce({
      authorized: false,
      status: 401,
      error: 'Unauthorized',
    })

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when variation not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Variation not found')
  })

  it('returns 404 when product not found', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Product not found')
  })

  it('successfully soft-deletes variation', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.message).toBe('Variation soft-deleted successfully')
    expect(data.data.id).toBe('var123')
  })

  it('invalidates product caches after deletion', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct)

    const request = new NextRequest(
      'http://localhost/api/admin/variations/var123',
      {
        method: 'DELETE',
      }
    )

    await DELETE(request, {
      params: Promise.resolve({ variationId: 'var123' }),
    })

    expect(mockInvalidateProductCaches).toHaveBeenCalledWith('prod123')
  })
})
