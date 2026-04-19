import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/admin/products/[id]/options/[optionId]/route'

const mockOptionFindFirst = vi.hoisted(() => vi.fn())
const mockDeleteWhere = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const mockDelete = vi.hoisted(() => vi.fn(() => ({ where: mockDeleteWhere })))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      productOptions: { findFirst: mockOptionFindFirst },
    },
  },
  primaryDrizzleDb: {
    delete: mockDelete,
  },
}))

vi.mock('@/lib/schema', () => ({
  productOptions: { id: 'id', productId: 'productId' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ _op: 'eq', val })),
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
  }
})

import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { invalidateProductCaches } from '@/lib/cache'
import { revalidateTag } from 'next/cache'

const makeParams = (id: string, optionId: string) => ({
  params: Promise.resolve({ id, optionId }),
})

describe('DELETE /api/admin/products/[id]/options/[optionId]', () => {
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
      'http://localhost/api/admin/products/p1/options/o1',
      {
        method: 'DELETE',
      }
    )
    const res = await DELETE(req, makeParams('p1', 'o1'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Not authenticated')
  })

  it('returns 400 for invalid params', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })

    const req = new NextRequest(
      'http://localhost/api/admin/products//options/',
      { method: 'DELETE' }
    )
    const res = await DELETE(req, makeParams('', ''))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid route parameters')
    expect(mockOptionFindFirst).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled()
    expect(vi.mocked(invalidateProductCaches)).not.toHaveBeenCalled()
  })

  it('returns 404 when option not found', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockOptionFindFirst.mockResolvedValue(null)

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options/o1',
      {
        method: 'DELETE',
      }
    )
    const res = await DELETE(req, makeParams('p1', 'o1'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Option not found')
  })

  it('returns 404 when option belongs to different product', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockOptionFindFirst.mockResolvedValue({
      id: 'o1',
      productId: 'other-product',
    })

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options/o1',
      {
        method: 'DELETE',
      }
    )
    const res = await DELETE(req, makeParams('p1', 'o1'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Option not found')
  })

  it('deletes option successfully', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockOptionFindFirst.mockResolvedValue({ id: 'o1', productId: 'p1' })

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options/o1',
      {
        method: 'DELETE',
      }
    )
    const res = await DELETE(req, makeParams('p1', 'o1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.deleted).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith('products', {})
    expect(vi.mocked(invalidateProductCaches)).toHaveBeenCalledWith('p1')
  })

  it('returns 500 on internal error', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({
      authorized: true,
      userId: 'a1',
    })
    mockOptionFindFirst.mockRejectedValue(new Error('DB error'))

    const req = new NextRequest(
      'http://localhost/api/admin/products/p1/options/o1',
      {
        method: 'DELETE',
      }
    )
    const res = await DELETE(req, makeParams('p1', 'o1'))
    expect(res.status).toBe(500)
  })
})
