import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockValues = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockInsert = vi.hoisted(() => vi.fn(() => ({ values: mockValues })))

vi.mock('@/lib/db', () => ({
  drizzleDb: { insert: mockInsert },
}))
vi.mock('@/lib/schema', () => ({
  adminAuditLogs: { __table: 'admin_audit_logs' },
}))

import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'

describe('recordAdminAuditLog', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockValues.mockClear()
  })

  it('inserts the audit row with provided diff', async () => {
    await recordAdminAuditLog({
      userId: 'admin-1',
      entity: 'product',
      entityId: 'p1',
      action: 'update',
      diff: { price: { old: 100, new: 150 } },
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockValues).toHaveBeenCalledWith({
      userId: 'admin-1',
      entity: 'product',
      entityId: 'p1',
      action: 'update',
      diff: { price: { old: 100, new: 150 } },
    })
  })

  it('defaults diff to an empty object when omitted', async () => {
    await recordAdminAuditLog({
      userId: 'admin-1',
      entity: 'product',
      entityId: 'p1',
      action: 'delete',
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ diff: {} })
    )
  })

  it.each([
    ['', 'product', 'p1', 'update'],
    ['admin-1', '', 'p1', 'update'],
    ['admin-1', 'product', '', 'update'],
    ['admin-1', 'product', 'p1', ''],
  ])(
    'skips insert when a required field is missing (userId=%s, entity=%s, entityId=%s, action=%s)',
    async (userId, entity, entityId, action) => {
      await recordAdminAuditLog({ userId, entity, entityId, action })
      expect(mockInsert).not.toHaveBeenCalled()
    }
  )
})
