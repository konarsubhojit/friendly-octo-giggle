import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDrizzleDbQuery = vi.hoisted(() => ({
  notificationPreferences: { findFirst: vi.fn() },
  users: { findFirst: vi.fn() },
}))
const mockPrimaryInsert = vi.hoisted(() => vi.fn())
const mockValues = vi.hoisted(() => vi.fn())
const mockOnConflictDoUpdate = vi.hoisted(() => vi.fn())
const mockReturning = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: { query: mockDrizzleDbQuery },
  primaryDrizzleDb: { insert: mockPrimaryInsert },
}))
vi.mock('@/lib/schema', () => ({
  notificationPreferences: {
    __table: 'notificationPreferences',
    userId: 'userId',
  },
  users: { __table: 'users', email: 'email' },
}))
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ __eq: [col, val] }),
}))

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  isChannelEnabled,
  resolveNotificationRecipient,
  updateNotificationPreferences,
} from '@/features/account/services/notification-preferences'

const savedRow = {
  userId: 'user-1',
  transactionalEmail: false,
  transactionalPush: true,
  transactionalSms: false,
  marketingEmail: true,
  marketingPush: false,
  marketingSms: false,
}

describe('notification preferences service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReturning.mockResolvedValue([
      {
        userId: 'user-1',
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        transactionalPush: true,
      },
    ])
    mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning })
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    mockPrimaryInsert.mockReturnValue({ values: mockValues })
  })

  it('falls back to defaults when no row exists', async () => {
    mockDrizzleDbQuery.notificationPreferences.findFirst.mockResolvedValue(
      undefined
    )
    await expect(getNotificationPreferences('user-1')).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    )
  })

  it('returns saved preferences when a row exists', async () => {
    mockDrizzleDbQuery.notificationPreferences.findFirst.mockResolvedValue(
      savedRow
    )
    const prefs = await getNotificationPreferences('user-1')
    expect(prefs.transactionalEmail).toBe(false)
    expect(prefs.marketingEmail).toBe(true)
  })

  it('merges partial updates atomically without a prior read', async () => {
    const result = await updateNotificationPreferences('user-1', {
      transactionalPush: true,
    })

    expect(result).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      transactionalPush: true,
    })
    expect(mockPrimaryInsert).toHaveBeenCalledOnce()
    expect(
      mockDrizzleDbQuery.notificationPreferences.findFirst
    ).not.toHaveBeenCalled()
    // Only the supplied keys are overwritten on conflict, so a concurrent
    // update to another channel is not clobbered.
    expect(mockOnConflictDoUpdate.mock.calls[0][0].set).toEqual({
      transactionalPush: true,
      updatedAt: expect.any(Date),
    })
  })

  it('maps category/channel pairs to the right flag', () => {
    expect(isChannelEnabled(savedRow, 'transactional', 'push')).toBe(true)
    expect(isChannelEnabled(savedRow, 'transactional', 'email')).toBe(false)
    expect(isChannelEnabled(savedRow, 'marketing', 'email')).toBe(true)
    expect(isChannelEnabled(savedRow, 'marketing', 'sms')).toBe(false)
  })

  it('treats unknown recipients as guests using the defaults', async () => {
    mockDrizzleDbQuery.users.findFirst.mockResolvedValue(undefined)
    const recipient = await resolveNotificationRecipient('guest@example.com')
    expect(recipient.userId).toBeNull()
    expect(recipient.preferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES)
  })

  it('resolves registered recipients with their saved preferences', async () => {
    mockDrizzleDbQuery.users.findFirst.mockResolvedValue({ id: 'user-1' })
    mockDrizzleDbQuery.notificationPreferences.findFirst.mockResolvedValue(
      savedRow
    )
    const recipient = await resolveNotificationRecipient('user@example.com')
    expect(recipient.userId).toBe('user-1')
    expect(recipient.preferences.transactionalPush).toBe(true)
  })
})
