import { describe, it, expect, vi } from 'vitest'
import { createOrdersDefinition } from '@/features/admin/resources/orders'
import type { AdminPermission } from '@/lib/constants/roles'

const noop = vi.fn()
const noopAsync = vi.fn().mockResolvedValue({ succeeded: [], failed: [] })

const handlers = {
  onMarkShipped: noopAsync,
  onBulkCancel: noopAsync,
  onRefund: noop,
  onViewDetail: noop,
  onUpdateStatus: noop,
}

describe('orders ResourceListDefinition', () => {
  it('includes mark-shipped bulk action for FULFILMENT role', () => {
    const perms: AdminPermission[] = ['orders:read', 'orders:update']
    const def = createOrdersDefinition(perms, handlers)
    const bulkKeys = def.bulkActions.map((a) => a.key)
    expect(bulkKeys).toContain('mark_shipped')
  })

  it('excludes refund row action for FULFILMENT role', () => {
    const perms: AdminPermission[] = ['orders:read', 'orders:update']
    const def = createOrdersDefinition(perms, handlers)
    const row = { id: '1', customer: 'A', status: 'PENDING', total: '100', date: '2026-01-01' }
    const actionKeys = def.rowActions(row).map((a) => a.key)
    expect(actionKeys).not.toContain('refund')
    expect(actionKeys).toContain('update_status')
  })

  it('includes refund row action for ADMIN role', () => {
    const perms: AdminPermission[] = ['orders:read', 'orders:update', 'orders:refund']
    const def = createOrdersDefinition(perms, handlers)
    const row = { id: '1', customer: 'A', status: 'PENDING', total: '100', date: '2026-01-01' }
    const actionKeys = def.rowActions(row).map((a) => a.key)
    expect(actionKeys).toContain('refund')
  })

  it('has no bulk actions for read-only viewer', () => {
    const perms: AdminPermission[] = ['orders:read']
    const def = createOrdersDefinition(perms, handlers)
    expect(def.bulkActions).toHaveLength(0)
  })

  it('provides distinct empty and filtered-empty messages', () => {
    const perms: AdminPermission[] = ['orders:read']
    const def = createOrdersDefinition(perms, handlers)
    expect(def.emptyMessage).not.toEqual(def.filteredEmptyMessage)
    expect(def.emptyMessage).toBeTruthy()
    expect(def.filteredEmptyMessage).toBeTruthy()
  })
})
