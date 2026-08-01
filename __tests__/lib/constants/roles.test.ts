import { describe, it, expect } from 'vitest'
import {
  ADMIN_PERMISSIONS,
  getRoleLabel,
  getRolePermissions,
  hasPermission,
  isStaffRole,
  isUserRole,
  ROLE_PERMISSIONS,
  USER_ROLES,
} from '@/lib/constants/roles'

describe('roles', () => {
  it('exposes the four supported roles', () => {
    expect(USER_ROLES).toEqual(['CUSTOMER', 'ADMIN', 'SUPPORT', 'FULFILMENT'])
  })

  it('grants ADMIN every permission so existing operators keep full access', () => {
    for (const permission of ADMIN_PERMISSIONS) {
      expect(hasPermission('ADMIN', permission)).toBe(true)
    }
  })

  it('lets FULFILMENT update orders but not touch the catalog or users', () => {
    expect(hasPermission('FULFILMENT', 'orders:update')).toBe(true)
    expect(hasPermission('FULFILMENT', 'orders:read')).toBe(true)
    expect(hasPermission('FULFILMENT', 'products:read')).toBe(true)
    expect(hasPermission('FULFILMENT', 'products:write')).toBe(false)
    expect(hasPermission('FULFILMENT', 'users:manage')).toBe(false)
    expect(hasPermission('FULFILMENT', 'analytics:read')).toBe(false)
  })

  it('lets SUPPORT read orders and moderate reviews but not change roles', () => {
    expect(hasPermission('SUPPORT', 'orders:read')).toBe(true)
    expect(hasPermission('SUPPORT', 'reviews:moderate')).toBe(true)
    expect(hasPermission('SUPPORT', 'users:read')).toBe(true)
    expect(hasPermission('SUPPORT', 'users:manage')).toBe(false)
    expect(hasPermission('SUPPORT', 'orders:update')).toBe(false)
    expect(hasPermission('SUPPORT', 'products:write')).toBe(false)
  })

  it('grants CUSTOMER nothing', () => {
    expect(ROLE_PERMISSIONS.CUSTOMER).toEqual([])
    expect(isStaffRole('CUSTOMER')).toBe(false)
  })

  it('fails closed for unknown roles', () => {
    expect(hasPermission('SUPERUSER', 'orders:read')).toBe(false)
    expect(hasPermission(undefined, 'orders:read')).toBe(false)
    expect(getRolePermissions(null)).toEqual([])
    expect(isStaffRole('SUPERUSER')).toBe(false)
    expect(isUserRole('SUPERUSER')).toBe(false)
  })

  it('treats every non-customer role as staff', () => {
    expect(isStaffRole('ADMIN')).toBe(true)
    expect(isStaffRole('SUPPORT')).toBe(true)
    expect(isStaffRole('FULFILMENT')).toBe(true)
  })

  it('labels roles for display', () => {
    expect(getRoleLabel('FULFILMENT')).toBe('Fulfilment')
    expect(getRoleLabel('nope')).toBeNull()
  })
})
