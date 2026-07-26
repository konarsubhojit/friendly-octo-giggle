import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.hoisted(() => vi.fn())
const mockOnConflictDoUpdate = vi.hoisted(() => vi.fn())
const mockValues = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())
const mockWhere = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: { query: { pushSubscriptions: { findMany: mockFindMany } } },
  primaryDrizzleDb: { insert: mockInsert, delete: mockDelete },
}))
vi.mock('@/lib/schema', () => ({
  pushSubscriptions: {
    __table: 'pushSubscriptions',
    userId: 'userId',
    endpoint: 'endpoint',
  },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ __and: args }),
  eq: (col: unknown, val: unknown) => ({ __eq: [col, val] }),
}))

import {
  deletePushSubscription,
  deletePushSubscriptionByEndpoint,
  listPushSubscriptions,
  savePushSubscription,
} from '@/features/account/services/push-subscription-service'

const row = {
  id: 'sub0001',
  userId: 'user-1',
  endpoint: 'https://push.example.com/abc',
  p256dh: 'p256dh-key',
  auth: 'auth-key',
  userAgent: 'vitest',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('push subscription service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnConflictDoUpdate.mockResolvedValue(undefined)
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    mockInsert.mockReturnValue({ values: mockValues })
    mockWhere.mockResolvedValue(undefined)
    mockDelete.mockReturnValue({ where: mockWhere })
  })

  it('maps stored rows to the transport shape', async () => {
    mockFindMany.mockResolvedValue([row])
    await expect(listPushSubscriptions('user-1')).resolves.toEqual([
      {
        id: 'sub0001',
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      },
    ])
  })

  it('upserts on the endpoint so rotated keys replace the old ones', async () => {
    await savePushSubscription(
      'user-1',
      { endpoint: row.endpoint, keys: { p256dh: 'new-p', auth: 'new-a' } },
      'vitest'
    )

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', p256dh: 'new-p' })
    )
    const conflictArgs = mockOnConflictDoUpdate.mock.calls[0][0]
    expect(conflictArgs.target).toBe('endpoint')
    expect(conflictArgs.set.userId).toBe('user-1')
  })

  it('scopes user-initiated deletes to the owner', async () => {
    await deletePushSubscription('user-1', row.endpoint)
    expect(mockWhere).toHaveBeenCalledWith({
      __and: [
        { __eq: ['userId', 'user-1'] },
        { __eq: ['endpoint', row.endpoint] },
      ],
    })
  })

  it('deletes expired endpoints regardless of owner', async () => {
    await deletePushSubscriptionByEndpoint(row.endpoint)
    expect(mockWhere).toHaveBeenCalledWith({
      __eq: ['endpoint', row.endpoint],
    })
  })
})
