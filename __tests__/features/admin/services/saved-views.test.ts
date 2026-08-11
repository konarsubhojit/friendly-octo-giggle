import { describe, expect, it } from 'vitest'
import { isSavedViewVisibleToUser } from '@/features/admin/services/saved-views'

describe('saved view visibility', () => {
  it('shows a private view only to its owner', () => {
    const privateView = {
      id: 'svown01',
      ownerId: 'user-1',
      resource: 'orders',
      name: 'My queue',
      criteria: {},
      isBuiltIn: false,
      requiredPermission: null,
    }

    expect(isSavedViewVisibleToUser(privateView, 'user-1', ['orders:read'])).toBe(
      true
    )
    expect(isSavedViewVisibleToUser(privateView, 'user-2', ['orders:read'])).toBe(
      false
    )
  })

  it('shows a built-in view only when the viewer holds the required permission', () => {
    const builtInView = {
      id: 'svord01',
      ownerId: null,
      resource: 'orders',
      name: 'Awaiting fulfilment',
      criteria: {},
      isBuiltIn: true,
      requiredPermission: 'orders:read' as const,
    }

    expect(
      isSavedViewVisibleToUser(builtInView, 'user-1', ['orders:read'])
    ).toBe(true)
    expect(
      isSavedViewVisibleToUser(builtInView, 'user-1', ['products:read'])
    ).toBe(false)
  })
})
