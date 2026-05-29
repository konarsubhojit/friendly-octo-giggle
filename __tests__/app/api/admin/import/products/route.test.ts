import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckAdminAuth = vi.hoisted(() => vi.fn())
const mockTransaction = vi.hoisted(() => vi.fn())
const mockInvalidateProductCaches = vi.hoisted(() => vi.fn())
const mockRecordAdminAuditLog = vi.hoisted(() => vi.fn())

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: mockCheckAdminAuth,
}))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: {
    transaction: mockTransaction,
  },
}))

vi.mock('@/lib/schema', () => ({
  products: {},
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/cache', () => ({
  invalidateProductCaches: mockInvalidateProductCaches,
}))

vi.mock('@/features/admin/services/admin-audit-log', () => ({
  recordAdminAuditLog: mockRecordAdminAuditLog,
}))

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { POST } from '@/app/api/admin/import/products/route'

describe('POST /api/admin/import/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns auth error for non-admin users', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authenticated',
      status: 401,
    })

    const response = await POST(
      new Request('http://localhost/api/admin/import/products', {
        method: 'POST',
        body: JSON.stringify({ csv: 'name,description,image,category' }),
      })
    )

    expect(response.status).toBe(401)
  })

  it('returns validation report during dry-run', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-1',
    })

    const response = await POST(
      new Request('http://localhost/api/admin/import/products', {
        method: 'POST',
        body: JSON.stringify({
          dryRun: true,
          csv: 'name,description,image,category\nRose,Bloom,not-a-url,Flowers',
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.invalidRows).toBe(1)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('commits all rows after successful validation', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-1',
    })

    const mockValues = vi.fn()
    const mockInsert = vi.fn(() => ({ values: mockValues }))
    mockTransaction.mockImplementation(async (callback) =>
      callback({ insert: mockInsert })
    )

    const response = await POST(
      new Request('http://localhost/api/admin/import/products', {
        method: 'POST',
        body: JSON.stringify({
          dryRun: false,
          csv: 'name,description,image,category\nRose,Fresh flower,https://example.com/rose.jpg,Flowers',
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.committedRows).toBe(1)
    expect(mockValues).toHaveBeenCalledTimes(1)
    expect(mockInvalidateProductCaches).toHaveBeenCalled()
    expect(mockRecordAdminAuditLog).toHaveBeenCalled()
  })
})
