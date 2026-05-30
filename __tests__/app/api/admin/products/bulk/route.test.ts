import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckAdminAuth = vi.hoisted(() => vi.fn())
const mockUpdateWhere = vi.hoisted(() => vi.fn())
const mockUpdateSet = vi.hoisted(() =>
  vi.fn(() => ({ where: mockUpdateWhere }))
)
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })))
const mockInvalidateProductCaches = vi.hoisted(() => vi.fn())
const mockRecordAdminAuditLog = vi.hoisted(() => vi.fn())
const mockRevalidateTag = vi.hoisted(() => vi.fn())

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    update: mockUpdate,
  },
}))

vi.mock('@/lib/schema', () => ({
  products: {
    id: 'id',
    deletedAt: 'deletedAt',
  },
  productVariants: {
    productId: 'productId',
    price: 'price',
    stock: 'stock',
    deletedAt: 'deletedAt',
  },
}))

vi.mock('@/lib/cache', () => ({
  invalidateProductCaches: mockInvalidateProductCaches,
}))

vi.mock('@/features/admin/services/admin-audit-log', () => ({
  recordAdminAuditLog: mockRecordAdminAuditLog,
}))

vi.mock('next/cache', () => ({
  revalidateTag: mockRevalidateTag,
}))

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return {
    ...actual,
    and: vi.fn(),
    inArray: vi.fn(),
    isNull: vi.fn(),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    })),
  }
})

import { POST } from '@/app/api/admin/products/bulk/route'

describe('POST /api/admin/products/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-1',
    })
    mockUpdateWhere.mockResolvedValue({ rowCount: 2 })
  })

  it('rejects non-positive set prices', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/products/bulk', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'bulk_price_update',
          productIds: ['p1'],
          mode: 'set',
          amount: -5,
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Price must be greater than zero')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('invalidates affected product detail caches after a bulk update', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/products/bulk', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'bulk_stock_adjust',
          productIds: ['p1', 'p2'],
          mode: 'increment',
          amount: 3,
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(mockInvalidateProductCaches).toHaveBeenCalledWith(['p1', 'p2'])
    expect(mockRecordAdminAuditLog).toHaveBeenCalled()
    expect(mockRevalidateTag).toHaveBeenCalledWith('products', 'max')
  })
})
