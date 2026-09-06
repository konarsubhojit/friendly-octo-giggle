import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockValues = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockInsert = vi.hoisted(() => vi.fn(() => ({ values: mockValues })))
const mockLoggerError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: { insert: mockInsert },
}))
vi.mock('@/lib/schema', () => ({
  adminAuditLogs: { __table: 'admin_audit_logs' },
}))
vi.mock('@/lib/logger', () => ({
  logError: mockLoggerError,
}))

import {
  recordAdminAuditLog,
  sanitizeAuditDiff,
} from '@/features/admin/services/admin-audit-log'

describe('recordAdminAuditLog', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockValues.mockClear()
    mockLoggerError.mockClear()
    mockValues.mockResolvedValue(undefined)
  })

  it('inserts the audit row with provided diff and acting role', async () => {
    await recordAdminAuditLog({
      userId: 'admin-1',
      role: 'FULFILMENT',
      entity: 'product',
      entityId: 'p1',
      action: 'update',
      diff: { price: { old: 100, new: 150 } },
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockValues).toHaveBeenCalledWith({
      userId: 'admin-1',
      role: 'FULFILMENT',
      entity: 'product',
      entityId: 'p1',
      action: 'update',
      diff: { price: { old: 100, new: 150 } },
    })
  })

  it('stores a null role when the acting role is unknown', async () => {
    await recordAdminAuditLog({
      userId: 'admin-1',
      entity: 'product',
      entityId: 'p1',
      action: 'update',
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ role: null })
    )
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

  it('sanitizes sensitive keys recursively before insert', async () => {
    await recordAdminAuditLog({
      userId: 'admin-1',
      role: 'ADMIN',
      entity: 'saved_view',
      entityId: 'view-1',
      action: 'create',
      diff: {
        name: 'Ops triage',
        password: 'super-secret',
        nested: {
          paymentId: 'pay_123',
          filters: [{ token: 'abc' }, { visible: true }],
        },
      },
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: {
          name: 'Ops triage',
          password: '[REDACTED]',
          nested: {
            paymentId: '[REDACTED]',
            filters: [{ token: '[REDACTED]' }, { visible: true }],
          },
        },
      })
    )
  })

  it('logs and swallows insert failures', async () => {
    const error = new Error('insert failed')
    mockValues.mockRejectedValueOnce(error)

    await expect(
      recordAdminAuditLog({
        userId: 'admin-1',
        role: 'ADMIN',
        entity: 'product',
        entityId: 'p1',
        action: 'update',
        diff: { price: 100 },
      })
    ).resolves.toBeUndefined()

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        context: 'admin_audit_log_failure',
        userId: 'admin-1',
        additionalInfo: expect.objectContaining({
          entity: 'product',
          entityId: 'p1',
          action: 'update',
        }),
      })
    )
  })
})

describe('sanitizeAuditDiff', () => {
  it('redacts denylisted keys and preserves non-sensitive values', () => {
    expect(
      sanitizeAuditDiff({
        currentPassword: 'old-pass',
        sort: { field: 'createdAt', direction: 'desc' },
        criteria: {
          token: 'abc123',
          signature: 'sig',
          nested: {
            cvc: '123',
            visible: 'keep-me',
          },
        },
      })
    ).toEqual({
      currentPassword: '[REDACTED]',
      sort: { field: 'createdAt', direction: 'desc' },
      criteria: {
        token: '[REDACTED]',
        signature: '[REDACTED]',
        nested: {
          cvc: '[REDACTED]',
          visible: 'keep-me',
        },
      },
    })
  })
})
