import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDelete, mockLogBusinessEvent } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    delete: mockDelete,
  },
}))
vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
}))
vi.mock('@/lib/schema', () => ({
  adminAuditLogs: {
    createdAt: 'createdAt',
    id: 'id',
  },
}))
vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return {
    ...actual,
    lt: vi.fn(),
  }
})

import {
  ACTIVITY_RETENTION_MONTHS,
  activityRetentionFunction,
  deleteExpiredAdminAuditLogs,
  getActivityRetentionCutoff,
} from '@/lib/inngest/functions/activity-retention'

type FunctionInternals = {
  opts: {
    id: string
    triggers: ReadonlyArray<{ cron?: string }>
  }
  fn: (context: {
    step: {
      run: (_id: string, handler: () => Promise<number>) => Promise<number>
    }
  }) => Promise<{ deleted: number; cutoff: string }>
}

describe('activity retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes a 24-month cutoff', () => {
    const cutoff = getActivityRetentionCutoff(
      new Date('2026-08-01T12:00:00.000Z')
    )
    expect(ACTIVITY_RETENTION_MONTHS).toBe(24)
    expect(cutoff.toISOString()).toBe('2024-08-01T12:00:00.000Z')
  })

  it('deletes rows older than the cutoff and reports the deleted count', async () => {
    const returning = vi
      .fn()
      .mockResolvedValue([{ id: 'log1' }, { id: 'log2' }])
    const where = vi.fn(() => ({ returning }))
    mockDelete.mockReturnValue({ where })

    const deleted = await deleteExpiredAdminAuditLogs(
      new Date('2024-08-01T12:00:00.000Z')
    )

    expect(deleted).toBe(2)
  })

  it('registers a monthly cron and logs successful sweeps', async () => {
    const internals = activityRetentionFunction as unknown as FunctionInternals
    mockDelete.mockReturnValue({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'log1' }]),
      })),
    })

    const result = await internals.fn({
      step: {
        run: (_id, handler) => handler(),
      },
    })

    expect(internals.opts.id).toBe('activity-retention')
    expect(internals.opts.triggers).toEqual([{ cron: '0 4 1 * *' }])
    expect(result.deleted).toBe(1)
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron_admin_activity_retention_completed',
        success: true,
      })
    )
  })
})
