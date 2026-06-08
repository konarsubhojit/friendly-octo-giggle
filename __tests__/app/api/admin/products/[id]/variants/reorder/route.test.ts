import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCheckAdminAuth,
  mockTransaction,
  mockSet,
  mockWhere,
  mockRevalidateTag,
  mockInvalidateProductCaches,
} = vi.hoisted(() => {
  const mockSet = vi.fn()
  const mockWhere = vi.fn()
  const mockUpdate = vi.fn(() => ({
    set: (...args: unknown[]) => {
      mockSet(...args)
      return { where: (...w: unknown[]) => mockWhere(...w) }
    },
  }))
  const mockTransaction = vi.fn(
    async (fn: (tx: { update: typeof mockUpdate }) => Promise<unknown>) => {
      return fn({ update: mockUpdate })
    }
  )
  return {
    mockCheckAdminAuth: vi.fn(),
    mockTransaction,
    mockSet,
    mockWhere,
    mockRevalidateTag: vi.fn(),
    mockInvalidateProductCaches: vi.fn(),
  }
})

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))
vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: { transaction: mockTransaction },
}))
vi.mock('@/lib/schema', () => ({
  productVariants: { id: 'id' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }))
vi.mock('@/lib/cache', () => ({
  invalidateProductCaches: mockInvalidateProductCaches,
}))
vi.mock(
  '@/features/product/validations',
  async () => await vi.importActual('@/features/product/validations')
)

import { PATCH } from '@/app/api/admin/products/[id]/variants/reorder/route'

function makeRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/admin/products/p1/variants/reorder',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

const params = Promise.resolve({ id: 'p1' })

describe('PATCH /api/admin/products/[id]/variants/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when checkAdminAuth says unauthenticated', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })

    const response = await PATCH(
      makeRequest({ items: [{ id: 'v123456', sortOrder: 0 }] }),
      { params }
    )

    expect(response.status).toBe(401)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns 403 for non-admin users', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    })

    const response = await PATCH(
      makeRequest({ items: [{ id: 'v123456', sortOrder: 0 }] }),
      { params }
    )

    expect(response.status).toBe(403)
  })

  it('returns 400 when items is empty', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })

    const response = await PATCH(makeRequest({ items: [] }), { params })

    expect(response.status).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('reorders variants and invalidates product caches on success', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })

    const response = await PATCH(
      makeRequest({
        items: [
          { id: 'v123456', sortOrder: 0 },
          { id: 'v234567', sortOrder: 1 },
        ],
      }),
      { params }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ reordered: true })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledTimes(2)
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sortOrder: 0, updatedAt: expect.any(Date) })
    )
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sortOrder: 1, updatedAt: expect.any(Date) })
    )
    expect(mockRevalidateTag).toHaveBeenCalledWith('products', {})
    expect(mockInvalidateProductCaches).toHaveBeenCalledWith('p1')
  })

  it('returns 500 when the transaction throws', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockTransaction.mockRejectedValueOnce(new Error('tx failed'))

    const response = await PATCH(
      makeRequest({ items: [{ id: 'v123456', sortOrder: 0 }] }),
      { params }
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('tx failed')
    expect(mockRevalidateTag).not.toHaveBeenCalled()
    expect(mockInvalidateProductCaches).not.toHaveBeenCalled()
  })
})
