import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

import { checkAdminAuth } from '@/features/admin/services/admin-auth'

describe('admin-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkAdminAuth', () => {
    it('returns unauthorized when no session exists', async () => {
      mockAuth.mockResolvedValue(null)

      const result = await checkAdminAuth('orders:read')

      expect(result).toEqual({
        authorized: false,
        error: 'Not authenticated',
        status: 401,
      })
    })

    it('returns unauthorized when session has no user', async () => {
      mockAuth.mockResolvedValue({})

      const result = await checkAdminAuth('orders:read')

      expect(result).toEqual({
        authorized: false,
        error: 'Not authenticated',
        status: 401,
      })
    })

    it('returns unauthorized when session user is undefined', async () => {
      mockAuth.mockResolvedValue({ user: undefined })

      const result = await checkAdminAuth('orders:read')

      expect(result).toEqual({
        authorized: false,
        error: 'Not authenticated',
        status: 401,
      })
    })

    it('returns forbidden when user is not ADMIN', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1', role: 'CUSTOMER' },
      })

      const result = await checkAdminAuth('orders:read')

      expect(result).toEqual({
        authorized: false,
        error: 'Not authorized - Admin access required',
        status: 403,
      })
    })

    it('returns forbidden when user role is undefined', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user1' },
      })

      const result = await checkAdminAuth('orders:read')

      expect(result).toEqual({
        authorized: false,
        error: 'Not authorized - Admin access required',
        status: 403,
      })
    })

    it('grants FULFILMENT order updates but refuses product writes', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'staff1', role: 'FULFILMENT' },
      })

      await expect(checkAdminAuth('orders:update')).resolves.toEqual({
        authorized: true,
        role: 'FULFILMENT',
        userId: 'staff1',
      })
      await expect(checkAdminAuth('products:write')).resolves.toEqual({
        authorized: false,
        error: 'Not authorized - "products:write" permission required',
        status: 403,
      })
    })

    it('grants SUPPORT review moderation but refuses user management', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'staff2', role: 'SUPPORT' },
      })

      await expect(checkAdminAuth('reviews:moderate')).resolves.toEqual({
        authorized: true,
        role: 'SUPPORT',
        userId: 'staff2',
      })
      await expect(checkAdminAuth('users:manage')).resolves.toEqual({
        authorized: false,
        error: 'Not authorized - "users:manage" permission required',
        status: 403,
      })
    })

    it('returns authorized with userId for ADMIN user', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      })

      const result = await checkAdminAuth('orders:read')

      expect(result).toEqual({
        authorized: true,
        role: 'ADMIN',
        userId: 'admin1',
      })
    })

    it('returns empty string userId when user id is undefined', async () => {
      mockAuth.mockResolvedValue({
        user: { role: 'ADMIN' },
      })

      const result = await checkAdminAuth('orders:read')

      expect(result).toEqual({
        authorized: true,
        role: 'ADMIN',
        userId: '',
      })
    })
  })
})
