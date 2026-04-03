import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockDb, mockLogError } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDb: {
    wishlists: {
      remove: vi.fn(),
    },
  },
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/logger', () => ({ logError: mockLogError }))

import { DELETE } from '@/app/api/wishlist/[productId]/route'

describe('wishlist/[productId] API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DELETE', () => {
    it('returns 401 for unauthenticated users', async () => {
      mockAuth.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/wishlist/p1')
      const response = await DELETE(request, {
        params: Promise.resolve({ productId: 'p1' }),
      })

      expect(response.status).toBe(401)
    })

    it('removes product from wishlist', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockDb.wishlists.remove.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost/api/wishlist/p1')
      const response = await DELETE(request, {
        params: Promise.resolve({ productId: 'p1' }),
      })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.productId).toBe('p1')
      expect(mockDb.wishlists.remove).toHaveBeenCalledWith('user1', 'p1')
    })

    it('handles errors', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user1' } })
      mockDb.wishlists.remove.mockRejectedValue(new Error('DB error'))

      const request = new NextRequest('http://localhost/api/wishlist/p1')
      const response = await DELETE(request, {
        params: Promise.resolve({ productId: 'p1' }),
      })

      expect(response.status).toBe(500)
      expect(mockLogError).toHaveBeenCalled()
    })
  })
})
