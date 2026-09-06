import { describe, it, expect, vi } from 'vitest'
import {
  ACTIONABLE_QUEUES,
  fetchActionableQueueCounts,
} from '@/features/admin/services/actionable-queues'
import type { AdminPermission } from '@/lib/constants/roles'

describe('actionable queues', () => {
  it('only returns queues the viewer is permitted to see', async () => {
    const perms: AdminPermission[] = ['orders:read', 'products:read']
    const fetcher = vi.fn().mockResolvedValue(5)

    const results = await fetchActionableQueueCounts(perms, fetcher)
    const keys = results.map((r) => r.definition.key)

    expect(keys).toContain('orders-awaiting-fulfilment')
    expect(keys).toContain('stock-below-threshold')
    expect(keys).not.toContain('failed-emails')
    expect(keys).not.toContain('reviews-awaiting-moderation')
  })

  it('isolates queue failures without blocking others (FR-G06)', async () => {
    const perms: AdminPermission[] = [
      'orders:read',
      'products:read',
      'system:manage',
    ]
    const fetcher = vi.fn().mockImplementation((resource: string) => {
      if (resource === 'products') throw new Error('DB error')
      return Promise.resolve(10)
    })

    const results = await fetchActionableQueueCounts(perms, fetcher)
    const ordersQ = results.find(
      (r) => r.definition.key === 'orders-awaiting-fulfilment'
    )
    const stockQ = results.find(
      (r) => r.definition.key === 'stock-below-threshold'
    )

    expect(ordersQ?.count).toBe(10)
    expect(ordersQ?.error).toBeUndefined()
    expect(stockQ?.count).toBe(0)
    expect(stockQ?.error).toBe('DB error')
  })

  it('defines at least the five required queues', () => {
    expect(ACTIONABLE_QUEUES.length).toBeGreaterThanOrEqual(5)
    const keys = ACTIONABLE_QUEUES.map((q) => q.key)
    expect(keys).toContain('orders-awaiting-fulfilment')
    expect(keys).toContain('stock-below-threshold')
    expect(keys).toContain('failed-emails')
    expect(keys).toContain('reviews-awaiting-moderation')
    expect(keys).toContain('refunds-in-progress')
  })
})
