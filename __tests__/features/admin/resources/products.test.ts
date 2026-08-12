import { describe, it, expect, vi } from 'vitest'
import { createProductsDefinition } from '@/features/admin/resources/products'
import type { AdminPermission } from '@/lib/constants/roles'

const noop = vi.fn()
const noopAsync = vi.fn().mockResolvedValue({ succeeded: [], failed: [] })

const handlers = {
  onEdit: noop,
  onViewDetail: noop,
  onDelete: noop,
  onBulkDelete: noopAsync,
}

describe('products ResourceListDefinition', () => {
  it('includes delete bulk action for a role with products:write', () => {
    const perms: AdminPermission[] = ['products:read', 'products:write']
    const def = createProductsDefinition(perms, handlers)
    const bulkKeys = def.bulkActions.map((a) => a.key)
    expect(bulkKeys).toContain('delete')
    expect(
      def.bulkActions.find((a) => a.key === 'delete')
        ?.requiresTypedConfirmation
    ).toBe(true)
  })

  it('has no bulk actions for a read-only role', () => {
    const perms: AdminPermission[] = ['products:read']
    const def = createProductsDefinition(perms, handlers)
    expect(def.bulkActions).toHaveLength(0)
  })

  it('excludes edit/delete row actions for a read-only role', () => {
    const perms: AdminPermission[] = ['products:read']
    const def = createProductsDefinition(perms, handlers)
    const row = {
      id: '1',
      name: 'Widget',
      category: 'Gadgets',
      price: '10.00',
      stock: 5,
    }
    const actionKeys = def.rowActions(row).map((a) => a.key)
    expect(actionKeys).toContain('view')
    expect(actionKeys).not.toContain('edit')
    expect(actionKeys).not.toContain('delete')
  })

  it('includes edit/delete row actions for a role with products:write', () => {
    const perms: AdminPermission[] = ['products:read', 'products:write']
    const def = createProductsDefinition(perms, handlers)
    const row = {
      id: '1',
      name: 'Widget',
      category: 'Gadgets',
      price: '10.00',
      stock: 5,
    }
    const actionKeys = def.rowActions(row).map((a) => a.key)
    expect(actionKeys).toContain('edit')
    expect(actionKeys).toContain('delete')
  })

  it('provides distinct empty and filtered-empty messages', () => {
    const perms: AdminPermission[] = ['products:read']
    const def = createProductsDefinition(perms, handlers)
    expect(def.emptyMessage).not.toEqual(def.filteredEmptyMessage)
    expect(def.emptyMessage).toBeTruthy()
    expect(def.filteredEmptyMessage).toBeTruthy()
  })
})
