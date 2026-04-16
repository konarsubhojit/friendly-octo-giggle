import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
const mockReturning = vi.fn()
const mockValues = vi.fn()

const { mockCheckAdminAuth } = vi.hoisted(() => ({
  mockCheckAdminAuth: vi.fn(async () => ({ authorized: true, userId: 'a1' })),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      productVariants: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    insert: () => ({
      values: (...args: unknown[]) => {
        mockValues(...args)
        return { returning: () => mockReturning() }
      },
    }),
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
  price: 150.0,
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

describe('GET /api/admin/products/[id]/variations', () => {
  let GET: typeof import('@/app/api/admin/products/[id]/variations/route').GET

  beforeEach(async () => {
    vi.resetAllMocks()
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'a1' })
    const mod = await import('@/app/api/admin/products/[id]/variations/route')
    GET = mod.GET
  })

  it('returns 401 when unauthenticated', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    } as never)
    const res = await GET(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'GET'
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    } as never)
    const res = await GET(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'GET'
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when product not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    const res = await GET(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'GET'
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(404)
  })

  it('returns list of variants', async () => {
    mockFindFirst.mockResolvedValueOnce(mockProduct)
    mockFindMany.mockResolvedValueOnce([mockVariant])
    const res = await GET(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'GET'
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.count).toBe(1)
    expect(json.data.variants[0].price).toBe(150.0)
  })
})

describe('POST /api/admin/products/[id]/variations', () => {
  let POST: typeof import('@/app/api/admin/products/[id]/variations/route').POST

  beforeEach(async () => {
    vi.resetAllMocks()
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'a1' })
    const mod = await import('@/app/api/admin/products/[id]/variations/route')
    POST = mod.POST
  })

  const validBody = {
    price: 150.0,
    stock: 50,
  }

  it('returns 401 when unauthenticated', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    } as never)
    const res = await POST(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'POST',
        validBody
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    } as never)
    const res = await POST(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'POST',
        validBody
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(403)
  })

  it('returns 400 for validation errors', async () => {
    mockFindFirst.mockResolvedValueOnce(mockProduct)
    const res = await POST(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'POST',
        { stock: -1 }
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when price <= 0', async () => {
    mockFindFirst.mockResolvedValueOnce(mockProduct)
    const res = await POST(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'POST',
        {
          ...validBody,
          price: 0,
        }
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when 25-variant limit reached', async () => {
    mockFindFirst.mockResolvedValueOnce(mockProduct)
    mockFindMany.mockResolvedValueOnce(Array(25).fill({ id: 'x' }))
    const res = await POST(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'POST',
        validBody
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('25')
  })

  it('returns 201 on successful creation', async () => {
    mockFindFirst.mockResolvedValueOnce(mockProduct)
    mockFindMany.mockResolvedValueOnce([])
    mockReturning.mockResolvedValueOnce([mockVariant])
    const res = await POST(
      makeRequest(
        'http://localhost/api/admin/products/abc1234/variations',
        'POST',
        validBody
      ),
      { params: Promise.resolve({ id: 'abc1234' }) }
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.variant).toBeDefined()
  })
})
