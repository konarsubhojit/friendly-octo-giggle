import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/products/[id]/options/generate/route'

const mockProductFindFirst = vi.hoisted(() => vi.fn())
const mockVariantsFindMany = vi.hoisted(() => vi.fn())
const mockTransaction = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: { findFirst: mockProductFindFirst },
      productVariants: { findMany: mockVariantsFindMany },
    },
  },
  primaryDrizzleDb: {
    transaction: mockTransaction,
  },
}))

vi.mock('@/lib/schema', () => ({
  products: { id: 'id', deletedAt: 'deletedAt' },
  productOptions: { id: 'id', productId: 'productId' },
  productOptionValues: { optionId: 'optionId' },
  productVariants: { productId: 'productId', deletedAt: 'deletedAt' },
  productVariantOptionValues: {
    variantId: 'variantId',
    optionValueId: 'optionValueId',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ _op: 'eq', val })),
  and: vi.fn((...args) => ({ _op: 'and', args })),
  isNull: vi.fn((col) => ({ _op: 'isNull', col })),
  inArray: vi.fn((_col, vals) => ({ _op: 'inArray', vals })),
}))

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))

vi.mock('@/lib/cache', () => ({
  invalidateProductCaches: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/api-utils', async () => {
  const { NextResponse } = await import('next/server')
  return {
    apiSuccess: (data: unknown, status = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    apiError: (error: string, status = 400) =>
      NextResponse.json({ success: false, error }, { status }),
    handleApiError: (error: unknown) =>
      NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal error',
        },
        { status: 500 }
      ),
    handleValidationError: (error: unknown) =>
      NextResponse.json(
        { success: false, error: 'Validation error', details: error },
        { status: 400 }
      ),
  }
})

import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { invalidateProductCaches } from '@/lib/cache'
import { revalidateTag } from 'next/cache'

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/products/p1/options/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

describe('POST /api/admin/products/[id]/options/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })
    const res = await POST(
      makeRequest({ optionNames: ['Color'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 when product not found', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue(null)

    const res = await POST(
      makeRequest({ optionNames: ['Color'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Product not found')
  })

  it('returns 400 for invalid input (empty optionNames)', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })

    const res = await POST(makeRequest({ optionNames: [] }), makeParams('p1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid input (too many option names)', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })

    const res = await POST(
      makeRequest({ optionNames: ['A', 'B', 'C', 'D', 'E', 'F'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when no variants found', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockVariantsFindMany.mockResolvedValue([])

    const res = await POST(
      makeRequest({ optionNames: ['Color'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('No variants found for this product')
  })

  it('returns 400 when a variant has no SKU', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockVariantsFindMany.mockResolvedValue([
      { id: 'v1', sku: null, productId: 'p1' },
    ])

    const res = await POST(
      makeRequest({ optionNames: ['Color'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('has no SKU')
  })

  it('returns 400 when SKU segment count mismatches option names', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockVariantsFindMany.mockResolvedValue([
      { id: 'v1', sku: 'Red-L-Cotton', productId: 'p1' },
    ])

    const res = await POST(
      makeRequest({ optionNames: ['Color', 'Size'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('splits into 3 segments but 2 option names')
  })

  it('generates options from SKUs successfully', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockVariantsFindMany.mockResolvedValue([
      { id: 'v1', sku: 'Red-L', productId: 'p1' },
      { id: 'v2', sku: 'Red-XL', productId: 'p1' },
      { id: 'v3', sku: 'Blue-L', productId: 'p1' },
    ])

    const createdOptions = [
      {
        id: 'o1',
        productId: 'p1',
        name: 'Color',
        sortOrder: 0,
        createdAt: new Date('2025-01-01'),
        values: [
          {
            id: 'ov1',
            optionId: 'o1',
            value: 'Red',
            sortOrder: 0,
            createdAt: new Date('2025-01-01'),
          },
          {
            id: 'ov2',
            optionId: 'o1',
            value: 'Blue',
            sortOrder: 1,
            createdAt: new Date('2025-01-01'),
          },
        ],
      },
      {
        id: 'o2',
        productId: 'p1',
        name: 'Size',
        sortOrder: 1,
        createdAt: new Date('2025-01-01'),
        values: [
          {
            id: 'ov3',
            optionId: 'o2',
            value: 'L',
            sortOrder: 0,
            createdAt: new Date('2025-01-01'),
          },
          {
            id: 'ov4',
            optionId: 'o2',
            value: 'XL',
            sortOrder: 1,
            createdAt: new Date('2025-01-01'),
          },
        ],
      },
    ]

    let insertCallCount = 0
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          delete: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => {
                insertCallCount++
                // First two inserts are option inserts, next two are value inserts
                if (insertCallCount === 1) return [{ id: 'o1' }]
                if (insertCallCount === 2)
                  return [
                    { id: 'ov1', value: 'Red' },
                    { id: 'ov2', value: 'Blue' },
                  ]
                if (insertCallCount === 3) return [{ id: 'o2' }]
                if (insertCallCount === 4)
                  return [
                    { id: 'ov3', value: 'L' },
                    { id: 'ov4', value: 'XL' },
                  ]
                return []
              }),
            })),
          })),
          query: {
            productOptions: {
              findMany: vi.fn().mockResolvedValue(createdOptions),
            },
          },
        }
        return fn(tx)
      }
    )

    const res = await POST(
      makeRequest({ optionNames: ['Color', 'Size'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.options).toHaveLength(2)
    expect(json.data.options[0].name).toBe('Color')
    expect(json.data.options[1].name).toBe('Size')
    expect(json.data.variantsLinked).toBe(3)
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith('products', {})
    expect(vi.mocked(invalidateProductCaches)).toHaveBeenCalledWith('p1')
  })

  it('uses custom delimiter', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockVariantsFindMany.mockResolvedValue([
      { id: 'v1', sku: 'Red_L', productId: 'p1' },
    ])

    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          delete: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi
                .fn()
                .mockResolvedValue([{ id: 'o1', value: 'Red' }]),
            })),
          })),
          query: {
            productOptions: {
              findMany: vi.fn().mockResolvedValue([
                {
                  id: 'o1',
                  productId: 'p1',
                  name: 'Color',
                  sortOrder: 0,
                  createdAt: new Date('2025-01-01'),
                  values: [
                    {
                      id: 'ov1',
                      optionId: 'o1',
                      value: 'Red',
                      sortOrder: 0,
                      createdAt: new Date('2025-01-01'),
                    },
                  ],
                },
                {
                  id: 'o2',
                  productId: 'p1',
                  name: 'Size',
                  sortOrder: 1,
                  createdAt: new Date('2025-01-01'),
                  values: [
                    {
                      id: 'ov2',
                      optionId: 'o2',
                      value: 'L',
                      sortOrder: 0,
                      createdAt: new Date('2025-01-01'),
                    },
                  ],
                },
              ]),
            },
          },
        }
        return fn(tx)
      }
    )

    const res = await POST(
      makeRequest({ optionNames: ['Color', 'Size'], delimiter: '_' }),
      makeParams('p1')
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.options).toHaveLength(2)
  })

  it('returns 500 on transaction error', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockVariantsFindMany.mockResolvedValue([
      { id: 'v1', sku: 'Red-L', productId: 'p1' },
    ])
    mockTransaction.mockRejectedValue(new Error('TX failure'))

    const res = await POST(
      makeRequest({ optionNames: ['Color', 'Size'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(500)
  })

  it('handles single option name with single segment SKU', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockVariantsFindMany.mockResolvedValue([
      { id: 'v1', sku: 'Classic', productId: 'p1' },
      { id: 'v2', sku: 'Premium', productId: 'p1' },
    ])

    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          delete: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([
                { id: 'ov1', value: 'Classic' },
                { id: 'ov2', value: 'Premium' },
              ]),
            })),
          })),
          query: {
            productOptions: {
              findMany: vi.fn().mockResolvedValue([
                {
                  id: 'o1',
                  productId: 'p1',
                  name: 'Style',
                  sortOrder: 0,
                  createdAt: new Date('2025-01-01'),
                  values: [
                    {
                      id: 'ov1',
                      optionId: 'o1',
                      value: 'Classic',
                      sortOrder: 0,
                      createdAt: new Date('2025-01-01'),
                    },
                    {
                      id: 'ov2',
                      optionId: 'o1',
                      value: 'Premium',
                      sortOrder: 1,
                      createdAt: new Date('2025-01-01'),
                    },
                  ],
                },
              ]),
            },
          },
        }
        return fn(tx)
      }
    )

    const res = await POST(
      makeRequest({ optionNames: ['Style'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.options).toHaveLength(1)
    expect(json.data.options[0].name).toBe('Style')
    expect(json.data.variantsLinked).toBe(2)
  })

  it('defaults delimiter to hyphen when not provided', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockVariantsFindMany.mockResolvedValue([
      { id: 'v1', sku: 'Red-L', productId: 'p1' },
    ])

    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          delete: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi
                .fn()
                .mockResolvedValue([{ id: 'ov1', value: 'Red' }]),
            })),
          })),
          query: {
            productOptions: {
              findMany: vi.fn().mockResolvedValue([
                {
                  id: 'o1',
                  productId: 'p1',
                  name: 'Color',
                  sortOrder: 0,
                  createdAt: new Date('2025-01-01'),
                  values: [
                    {
                      id: 'ov1',
                      optionId: 'o1',
                      value: 'Red',
                      sortOrder: 0,
                      createdAt: new Date('2025-01-01'),
                    },
                  ],
                },
              ]),
            },
          },
        }
        return fn(tx)
      }
    )

    // No delimiter property in body
    const res = await POST(
      makeRequest({ optionNames: ['Color', 'Size'] }),
      makeParams('p1')
    )
    expect(res.status).toBe(201)
  })
})
