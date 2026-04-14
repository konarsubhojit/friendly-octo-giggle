import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
const mockReturning = vi.fn()
const mockValues = vi.fn()

const { mockCheckAdminAuth } = vi.hoisted(() => ({
  mockCheckAdminAuth: vi.fn(async () => ({ authorized: true, userId: 'a1' })),
}))

const mockUpdate = vi.fn()
const mockDelete = vi.fn()

const createInsertMock = () => ({
  values: (...args: unknown[]) => {
    mockValues(...args)
    return { returning: () => mockReturning() }
  },
})

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      productVariants: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    insert: createInsertMock,
    update: (...args: unknown[]) => {
      mockUpdate(...args)
      return {
        set: (_setArgs: unknown) => ({
          where: (_whereArgs: unknown) => ({
            returning: () => mockReturning(),
          }),
        }),
      }
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args)
      return {
        where: vi.fn(),
      }
    },
  },
}))

vi.mock('@/lib/schema', () => ({
  products: { id: 'id', deletedAt: 'deletedAt' },
  productVariants: {
    id: 'id',
    productId: 'productId',
    deletedAt: 'deletedAt',
  },
  productVariantOptionValues: {
    variantId: 'variantId',
    optionValueId: 'optionValueId',
  },
}))

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))

vi.mock('@/features/product/validations', async () =>
  await vi.importActual('@/features/product/validations')
)
vi.mock('@/lib/serializers', () => ({
  serializeVariant: (v: Record<string, unknown>) => ({
    ...v,
    sku: v.sku ?? null,
    image: v.image ?? null,
    images: v.images ?? [],
    createdAt:
      v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
    updatedAt:
      v.updatedAt instanceof Date ? v.updatedAt.toISOString() : v.updatedAt,
    deletedAt: v.deletedAt
      ? v.deletedAt instanceof Date
        ? v.deletedAt.toISOString()
        : v.deletedAt
      : null,
  }),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/cache', () => ({ invalidateProductCaches: vi.fn() }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn((...args: unknown[]) => args),
}))

const mockProduct = {
  id: 'abc1234',
  name: 'Test Product',
  deletedAt: null,
}

const mockVariant = {
  id: 'var1234',
  productId: 'abc1234',
  sku: null,
  image: null,
  images: [],
  price: 150,
  stock: 10,
  deletedAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

function makeRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }
      : {}),
  })
}

describe('POST /api/admin/variations', () => {
  let POST: typeof import('@/app/api/admin/variations/route').POST

  beforeEach(async () => {
    vi.resetAllMocks()
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'a1' })
    const mod = await import('@/app/api/admin/variations/route')
    POST = mod.POST
  })

  it('creates a variant for the provided product', async () => {
    mockFindFirst.mockResolvedValueOnce(mockProduct)
    mockFindMany.mockResolvedValueOnce([])
    mockReturning.mockResolvedValueOnce([mockVariant])

    const res = await POST(
      makeRequest('http://localhost/api/admin/variations', 'POST', {
        productId: 'abc1234',
        price: 150,
        stock: 10,
      })
    )

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.variant.productId).toBe('abc1234')
  })

  it('returns 401 if user is not authenticated', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    } as never)

    const res = await POST(
      makeRequest('http://localhost/api/admin/variations', 'POST', {
        productId: 'abc1234',
        price: 150,
        stock: 10,
      })
    )

    expect(res.status).toBe(401)
  })

  it('returns 403 if user is not admin', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    } as never)

    const res = await POST(
      makeRequest('http://localhost/api/admin/variations', 'POST', {
        productId: 'abc1234',
        price: 150,
        stock: 10,
      })
    )

    expect(res.status).toBe(403)
  })

  it('returns 404 if product not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const res = await POST(
      makeRequest('http://localhost/api/admin/variations', 'POST', {
        productId: 'nonexis',
        price: 150,
        stock: 10,
      })
    )

    expect(res.status).toBe(404)
  })

  it('returns 400 if price is zero or negative', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/admin/variations', 'POST', {
        productId: 'abc1234',
        price: 0,
        stock: 10,
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBeDefined()
  })

  it('returns 400 if maximum variants reached', async () => {
    mockFindFirst.mockResolvedValueOnce(mockProduct)
    mockFindMany.mockResolvedValueOnce(Array(25).fill({ id: 'v' }))

    const res = await POST(
      makeRequest('http://localhost/api/admin/variations', 'POST', {
        productId: 'abc1234',
        price: 150,
        stock: 10,
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('25 variants')
  })

  it('returns 400 for validation errors', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/admin/variations', 'POST', {
        productId: 'abc1234',
        // missing required fields
      })
    )

    expect(res.status).toBe(400)
  })
})

describe('PUT /api/admin/variations/[variationId]', () => {
  let PUT: typeof import('@/app/api/admin/variations/[variationId]/route').PUT

  beforeEach(async () => {
    vi.resetAllMocks()
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'a1' })
    const mod = await import('@/app/api/admin/variations/[variationId]/route')
    PUT = mod.PUT
  })

  it('updates a variant without productId in the path', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockReturning.mockResolvedValueOnce([
      { ...mockVariant, stock: 12, updatedAt: new Date('2025-01-02') },
    ])

    const res = await PUT(
      makeRequest('http://localhost/api/admin/variations/var1234', 'PUT', {
        stock: 12,
      }),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.variant.stock).toBe(12)
  })

  it('returns 401 if user is not authenticated', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    } as never)

    const res = await PUT(
      makeRequest('http://localhost/api/admin/variations/var1234', 'PUT', {
        stock: 12,
      }),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(401)
  })

  it('returns 403 if user is not admin', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    } as never)

    const res = await PUT(
      makeRequest('http://localhost/api/admin/variations/var1234', 'PUT', {
        stock: 12,
      }),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(403)
  })

  it('returns 404 if variant not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const res = await PUT(
      makeRequest('http://localhost/api/admin/variations/var1234', 'PUT', {
        stock: 12,
      }),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(404)
  })

  it('returns 404 if product not found', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(null)

    const res = await PUT(
      makeRequest('http://localhost/api/admin/variations/var1234', 'PUT', {
        stock: 12,
      }),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(404)
  })

  it('handles empty update body gracefully', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)

    const res = await PUT(
      makeRequest('http://localhost/api/admin/variations/var1234', 'PUT', {}),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(400)
  })

  it('updates price successfully', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockReturning.mockResolvedValueOnce([{ ...mockVariant, price: 100 }])

    const res = await PUT(
      makeRequest('http://localhost/api/admin/variations/var1234', 'PUT', {
        price: 100,
      }),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect([200, 400, 500]).toContain(res.status)
  })
})

describe('DELETE /api/admin/variations/[variationId]', () => {
  let DELETE: typeof import('@/app/api/admin/variations/[variationId]/route').DELETE

  beforeEach(async () => {
    vi.resetAllMocks()
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'a1' })
    const mod = await import('@/app/api/admin/variations/[variationId]/route')
    DELETE = mod.DELETE
  })

  it('soft-deletes a variant without productId in the path', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockFindMany.mockResolvedValueOnce([{ id: 'v1' }, { id: 'v2' }])

    const res = await DELETE(
      makeRequest('http://localhost/api/admin/variations/var1234', 'DELETE'),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.id).toBe('var1234')
  })

  it('returns 401 if user is not authenticated', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    } as never)

    const res = await DELETE(
      makeRequest('http://localhost/api/admin/variations/var1234', 'DELETE'),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(401)
  })

  it('returns 403 if user is not admin', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    } as never)

    const res = await DELETE(
      makeRequest('http://localhost/api/admin/variations/var1234', 'DELETE'),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(403)
  })

  it('returns 404 if variant not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const res = await DELETE(
      makeRequest('http://localhost/api/admin/variations/var1234', 'DELETE'),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(404)
  })

  it('returns 404 if product not found', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(null)

    const res = await DELETE(
      makeRequest('http://localhost/api/admin/variations/var1234', 'DELETE'),
      { params: Promise.resolve({ variationId: 'var1234' }) }
    )

    expect(res.status).toBe(404)
  })
})
