import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckAdminAuth = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockUpdateWhere = vi.hoisted(() => vi.fn())
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })))
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })))
const mockInvalidateAdminOrderCaches = vi.hoisted(() => vi.fn())
const mockRecordAdminAuditLog = vi.hoisted(() => vi.fn())

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      orders: {
        findMany: mockFindMany,
      },
    },
    update: mockUpdate,
  },
}))

vi.mock('@/lib/schema', () => ({
  orders: {
    id: 'id',
  },
}))

vi.mock('@/lib/cache', () => ({
  invalidateAdminOrderCaches: mockInvalidateAdminOrderCaches,
}))

vi.mock('@/features/admin/services/admin-audit-log', () => ({
  recordAdminAuditLog: mockRecordAdminAuditLog,
}))

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return {
    ...actual,
    inArray: vi.fn(),
  }
})

import { POST } from '@/app/api/admin/orders/bulk/route'
import { OrderStatus } from '@/lib/types'

describe('POST /api/admin/orders/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-1',
    })
    mockFindMany.mockResolvedValue([
      { id: 'o1', userId: 'u1' },
      { id: 'o2', userId: 'u2' },
    ])
    mockUpdateWhere.mockResolvedValue({ rowCount: 2 })
  })

  it('invalidates admin and customer order caches for updated orders', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/orders/bulk', {
        method: 'POST',
        body: JSON.stringify({
          orderIds: ['o1', 'o2'],
          status: OrderStatus.SHIPPED,
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(mockInvalidateAdminOrderCaches).toHaveBeenCalledWith(
      ['o1', 'o2'],
      ['u1', 'u2']
    )
    expect(mockRecordAdminAuditLog).toHaveBeenCalled()
  })
})
