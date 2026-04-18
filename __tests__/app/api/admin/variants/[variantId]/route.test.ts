import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCheckAdminAuth,
  mockInvalidateProductCaches,
  mockRevalidateTag,
  mockFindFirst,
  mockFindMany,
  mockUpdate,
  mockReturning,
  mockDelete,
  mockExecute,
} = vi.hoisted(() => ({
  mockCheckAdminAuth: vi.fn(async () => ({ authorized: true })),
  mockInvalidateProductCaches: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockReturning: vi.fn(),
  mockDelete: vi.fn(),
  mockExecute: vi.fn(async () => ({ rows: [{ id: 'var123' }] })),
}))

const makeTx = () => ({
  query: {
    productVariants: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
  execute: ((...args: unknown[]) => mockExecute(...(args as [unknown]))) as typeof mockExecute,
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
    return { where: vi.fn() }
  },
  insert: () => ({
    values: () => ({ returning: vi.fn() }),
  }),
})

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      productVariants: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
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
    insert: () => ({
      values: () => ({ returning: vi.fn() }),
    }),
  },
  primaryDrizzleDb: {
    transaction: (
      callback: (tx: ReturnType<typeof makeTx>) => Promise<unknown>
    ) => callback(makeTx()),
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
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
    { raw: (s: string) => s }
  ),
}))

vi.mock(
  '@/features/product/validations',
  async () => await vi.importActual('@/features/product/validations')
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

import { PUT, DELETE } from '@/app/api/admin/variants/[variantId]/route'

const mockVariant = {
  id: 'var123',
  productId: 'prod123',
  sku: null,
  image: null,
  images: [],
  price: 100,
  stock: 10,
  deletedAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

const mockProduct = {
  id: 'prod123',
  name: 'Test Product',
  deletedAt: null,
}

describe('PUT /api/admin/variants/[variantId]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockCheckAdminAuth.mockResolvedValue({ authorized: true })
    mockFindFirst.mockResolvedValue(null)
  })

  it('returns 401 when not authenticated as admin', async () => {
    mockCheckAdminAuth.mockResolvedValueOnce({
      authorized: false,
      status: 401,
      error: 'Unauthorized',
    } as never)

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ stock: 20 }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when variant not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ stock: 20 }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Variant not found')
  })

  it('returns 404 when product not found', async () => {
    mockFindFirst.mockResolvedValueOnce(mockVariant).mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ stock: 20 }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Product not found')
  })

  it('returns validation error for invalid data', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ price: 'invalid' }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('returns 400 when no fields to update', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'PUT',
        body: JSON.stringify({}),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('No fields to update')
  })

  it('successfully updates variant', async () => {
    const updatedVariant = {
      ...mockVariant,
      stock: 20,
      updatedAt: new Date(),
    }
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockReturning.mockResolvedValueOnce([updatedVariant])

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ stock: 20 }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.variant.stock).toBe(20)
  })

  it('updates variant with optionValueIds (replaces existing)', async () => {
    const updatedVariant = {
      ...mockVariant,
      price: 150,
      updatedAt: new Date(),
    }
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockReturning.mockResolvedValueOnce([updatedVariant])

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'PUT',
        body: JSON.stringify({
          price: 150,
          optionValueIds: ['ov12345', 'ov67890'],
        }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.variant.price).toBe(150)
  })

  it('updates variant with empty optionValueIds (clears existing)', async () => {
    const updatedVariant = {
      ...mockVariant,
      updatedAt: new Date(),
    }
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockReturning.mockResolvedValueOnce([updatedVariant])

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'PUT',
        body: JSON.stringify({ stock: 5, optionValueIds: [] }),
      }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })

    expect(response.status).toBe(200)
  })
})

describe('DELETE /api/admin/variants/[variantId]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockCheckAdminAuth.mockResolvedValue({ authorized: true })
    mockFindFirst.mockResolvedValue(null)
  })

  it('returns 401 when not authenticated as admin', async () => {
    mockCheckAdminAuth.mockResolvedValueOnce({
      authorized: false,
      status: 401,
      error: 'Unauthorized',
    } as never)

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when variant not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Variant not found')
  })

  it('returns 404 when product not found', async () => {
    mockFindFirst.mockResolvedValueOnce(mockVariant).mockResolvedValueOnce(null)

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Product not found')
  })

  it('returns 400 when trying to delete the last variant', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockExecute.mockResolvedValueOnce({ rows: [] })
    mockFindMany.mockResolvedValueOnce([{ id: 'var123' }])

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Cannot delete the last variant of a product')
  })

  it('successfully soft-deletes variant', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'var123' }] })

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.message).toBe('Variant soft-deleted successfully')
    expect(data.data.id).toBe('var123')
  })

  it('invalidates product caches after deletion', async () => {
    mockFindFirst
      .mockResolvedValueOnce(mockVariant)
      .mockResolvedValueOnce(mockProduct)
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'var123' }] })

    const request = new NextRequest(
      'http://localhost/api/admin/variants/var123',
      {
        method: 'DELETE',
      }
    )

    await DELETE(request, {
      params: Promise.resolve({ variantId: 'var123' }),
    })

    expect(mockInvalidateProductCaches).toHaveBeenCalledWith('prod123')
  })
})
