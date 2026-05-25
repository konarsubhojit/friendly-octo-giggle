import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockUpdate, mockUpdateSet, mockUpdateWhere, mockUpdateReturning, mockDelete, mockDeleteWhere, mockDeleteReturning } =
  vi.hoisted(() => {
    const mockUpdateReturning = vi.fn()
    const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }))
    const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }))
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }))

    const mockDeleteReturning = vi.fn()
    const mockDeleteWhere = vi.fn(() => ({ returning: mockDeleteReturning }))
    const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }))

    return {
      mockUpdate,
      mockUpdateSet,
      mockUpdateWhere,
      mockUpdateReturning,
      mockDelete,
      mockDeleteWhere,
      mockDeleteReturning,
    }
  })

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    update: mockUpdate,
    delete: mockDelete,
  },
}))
vi.mock('@/lib/schema', () => ({
  reviews: { id: 'id' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}))
vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))
vi.mock('@/lib/api-middleware', () => ({
  withLogging: vi.fn((handler) => handler),
}))
vi.mock(
  '@/lib/validations',
  async () => await vi.importActual('@/lib/validations')
)
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

import { PATCH, DELETE } from '@/app/api/admin/reviews/[id]/route'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'

const mockCheckAdminAuth = vi.mocked(checkAdminAuth)

describe('Admin review moderation route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when admin auth fails', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      status: 401,
      error: 'Not authenticated',
    })
    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/reviews/rev1', {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: true }),
      }),
      { params: Promise.resolve({ id: 'rev1' }) }
    )
    expect(response.status).toBe(401)
  })

  it('updates moderation flags', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockUpdateReturning.mockResolvedValue([
      {
        id: 'rev1',
        isHidden: true,
        isFeatured: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      },
    ])

    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/reviews/rev1', {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: true }),
      }),
      { params: Promise.resolve({ id: 'rev1' }) }
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.review.isHidden).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('removes review', async () => {
    mockCheckAdminAuth.mockResolvedValue({ authorized: true, userId: 'admin' })
    mockDeleteReturning.mockResolvedValue([{ id: 'rev1' }])

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/reviews/rev1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'rev1' }) }
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.deleted).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
  })
})
