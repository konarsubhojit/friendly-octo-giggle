import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/admin/saved-views/route'

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))
vi.mock('@/features/admin/services/saved-views', () => ({
  listSavedViews: vi.fn(),
  createSavedView: vi.fn(),
}))

import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  createSavedView,
  listSavedViews,
} from '@/features/admin/services/saved-views'

const mockCheckAdminAuth = vi.mocked(checkAdminAuth)
const mockListSavedViews = vi.mocked(listSavedViews)
const mockCreateSavedView = vi.mocked(createSavedView)

describe('/api/admin/saved-views', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists views for the requested resource', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-1',
      role: 'ADMIN',
    })
    mockListSavedViews.mockResolvedValue([
      {
        id: 'sv1',
        resource: 'orders',
        name: 'Awaiting fulfilment',
        criteria: { filters: { status: ['PROCESSING'] } },
        isBuiltIn: true,
        owned: false,
      },
    ])

    const response = await GET(
      new NextRequest('http://localhost/api/admin/saved-views?resource=orders')
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockCheckAdminAuth).toHaveBeenCalledWith('orders:read')
    expect(mockListSavedViews).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', resource: 'orders' })
    )
    expect(payload.data.views).toHaveLength(1)
  })

  it('creates a saved view for the authorized resource', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-1',
      role: 'ADMIN',
    })
    mockCreateSavedView.mockResolvedValue({
      id: 'sv2',
      resource: 'orders',
      name: 'High value',
      criteria: { filters: { total: { gte: 10000 } } },
      isBuiltIn: false,
      owned: true,
    })

    const response = await POST(
      new NextRequest('http://localhost/api/admin/saved-views', {
        method: 'POST',
        body: JSON.stringify({
          resource: 'orders',
          name: 'High value',
          criteria: { filters: { total: { gte: 10000 } } },
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(mockCheckAdminAuth).toHaveBeenCalledWith('orders:read')
    expect(mockCreateSavedView).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        resource: 'orders',
      })
    )
    expect(payload.data.view.name).toBe('High value')
  })

  it('returns 403 when permission is missing', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized',
      status: 403,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/saved-views?resource=orders')
    )

    expect(response.status).toBe(403)
  })
})
