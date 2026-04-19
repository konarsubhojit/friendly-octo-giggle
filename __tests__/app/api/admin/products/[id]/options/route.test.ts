import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/admin/products/[id]/options/route'

// ─── Mocks ────────────────────────────────────────────────

const mockProductFindFirst = vi.hoisted(() => vi.fn())
const mockOptionsFindMany = vi.hoisted(() => vi.fn())
const mockTransaction = vi.hoisted(() => vi.fn())
const mockInsertReturning = vi.hoisted(() => vi.fn())
const mockInsertValues = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockInsertReturning }))
)
const mockInsert = vi.hoisted(() => vi.fn(() => ({ values: mockInsertValues })))
const mockOptionFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: { findFirst: mockProductFindFirst },
      productOptions: {
        findMany: mockOptionsFindMany,
        findFirst: mockOptionFindFirst,
      },
    },
  },
  primaryDrizzleDb: {
    transaction: mockTransaction,
    insert: mockInsert,
  },
}))

vi.mock('@/lib/schema', () => ({
  products: { id: 'id', deletedAt: 'deletedAt' },
  productOptions: { id: 'id', productId: 'productId' },
  productOptionValues: { optionId: 'optionId' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ _op: 'eq', val })),
  and: vi.fn((...args) => ({ _op: 'and', args })),
  isNull: vi.fn((col) => ({ _op: 'isNull', col })),
  sql: vi.fn((...args) => ({ _tag: 'sql', args })),
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

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

// ─── Tests ────────────────────────────────────────────────

describe('GET /api/admin/products/[id]/options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })
    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options'
    )
    const res = await GET(req, makeParams('p1'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Not authenticated')
  })

  it('returns 404 when product not found', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue(null)

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options'
    )
    const res = await GET(req, makeParams('p1'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Product not found')
  })

  it('returns options for a product', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockOptionsFindMany.mockResolvedValue([
      {
        id: 'o1',
        productId: 'p1',
        name: 'Color',
        sortOrder: 0,
        createdAt: new Date('2025-01-01'),
        values: [
          {
            id: 'v1',
            optionId: 'o1',
            value: 'Red',
            sortOrder: 0,
            createdAt: new Date('2025-01-01'),
          },
          {
            id: 'v2',
            optionId: 'o1',
            value: 'Blue',
            sortOrder: 1,
            createdAt: new Date('2025-01-01'),
          },
        ],
      },
    ])

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options'
    )
    const res = await GET(req, makeParams('p1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.options).toHaveLength(1)
    expect(json.data.options[0].name).toBe('Color')
    expect(json.data.options[0].values).toHaveLength(2)
    expect(json.data.options[0].values[0].value).toBe('Red')
  })

  it('returns empty array when product has no options', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockOptionsFindMany.mockResolvedValue([])

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options'
    )
    const res = await GET(req, makeParams('p1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.options).toHaveLength(0)
  })

  it('returns 500 on internal error', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockRejectedValue(new Error('DB down'))

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options'
    )
    const res = await GET(req, makeParams('p1'))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/admin/products/[id]/options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })
    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Color', values: [{ value: 'Red' }] }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const res = await POST(req, makeParams('p1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when product not found', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue(null)

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Color', values: [{ value: 'Red' }] }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const res = await POST(req, makeParams('p1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid input (missing name)', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options',
      {
        method: 'POST',
        body: JSON.stringify({ values: [{ value: 'Red' }] }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const res = await POST(req, makeParams('p1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid input (empty values array)', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Color', values: [] }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const res = await POST(req, makeParams('p1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when max options reached', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })

    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          execute: vi.fn().mockResolvedValue(null),
          query: {
            productOptions: {
              findMany: vi
                .fn()
                .mockResolvedValue([
                  { id: '1' },
                  { id: '2' },
                  { id: '3' },
                  { id: '4' },
                  { id: '5' },
                ]),
            },
          },
        }
        return fn(tx)
      }
    )

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Color', values: [{ value: 'Red' }] }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const res = await POST(req, makeParams('p1'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Maximum')
  })

  it('creates an option with values successfully', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockOptionsFindMany.mockResolvedValue([])

    const createdOption = {
      id: 'o1',
      productId: 'p1',
      name: 'Color',
      sortOrder: 0,
      createdAt: new Date('2025-01-01'),
      values: [
        {
          id: 'v1',
          optionId: 'o1',
          value: 'Red',
          sortOrder: 0,
          createdAt: new Date('2025-01-01'),
        },
      ],
    }

    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          execute: vi.fn().mockResolvedValue(null),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ id: 'o1' }]),
            })),
          })),
          query: {
            productOptions: {
              findMany: vi.fn().mockResolvedValue([]),
              findFirst: vi.fn().mockResolvedValue(createdOption),
            },
          },
        }
        return fn(tx)
      }
    )

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Color', values: [{ value: 'Red' }] }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const res = await POST(req, makeParams('p1'))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.option.name).toBe('Color')
    expect(json.data.option.values).toHaveLength(1)
  })

  it('returns 500 when transaction returns null', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockOptionsFindMany.mockResolvedValue([])

    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          execute: vi.fn().mockResolvedValue(null),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ id: 'o1' }]),
            })),
          })),
          query: {
            productOptions: {
              findMany: vi.fn().mockResolvedValue([]),
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        }
        return fn(tx)
      }
    )

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Size', values: [{ value: 'L' }] }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const res = await POST(req, makeParams('p1'))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to create option')
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockProductFindFirst.mockResolvedValue({ id: 'p1' })
    mockOptionsFindMany.mockResolvedValue([])
    mockTransaction.mockRejectedValue(new Error('TX fail'))

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Color', values: [{ value: 'Red' }] }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const res = await POST(req, makeParams('p1'))
    expect(res.status).toBe(500)
  })
})
