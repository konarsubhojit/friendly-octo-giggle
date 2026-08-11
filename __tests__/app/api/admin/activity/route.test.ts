import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/admin/activity/route'

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))
vi.mock('@/features/admin/services/admin-activity-query', () => ({
  getActivityRequiredPermission: vi.fn(),
  queryAdminActivity: vi.fn(),
}))

import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  getActivityRequiredPermission,
  queryAdminActivity,
} from '@/features/admin/services/admin-activity-query'

const mockCheckAdminAuth = vi.mocked(checkAdminAuth)
const mockGetActivityRequiredPermission = vi.mocked(getActivityRequiredPermission)
const mockQueryAdminActivity = vi.mocked(queryAdminActivity)

describe('GET /api/admin/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActivityRequiredPermission.mockImplementation((entity) =>
      entity ? 'orders:read' : 'system:manage'
    )
  })

  it('returns paginated global activity entries', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'admin-1',
      role: 'ADMIN',
    })
    mockQueryAdminActivity.mockResolvedValue({
      entries: [
        {
          id: 'log1',
          entity: 'order',
          entityId: 'ORD123',
          action: 'status_change',
          actor: { userId: 'admin-1', role: 'ADMIN' },
          changes: [{ field: 'status', before: 'PROCESSING', after: 'SHIPPED' }],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      nextCursor: 'cursor-1',
    })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/activity?action=status_change')
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockCheckAdminAuth).toHaveBeenCalledWith('system:manage')
    expect(payload.data.retentionWindowMonths).toBe(24)
    expect(payload.data.nextCursor).toBe('cursor-1')
  })

  it('uses entity-specific permission for entity mode', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'support-1',
      role: 'SUPPORT',
    })
    mockQueryAdminActivity.mockResolvedValue({
      entries: [],
      nextCursor: null,
    })

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/activity?entity=order&entityId=ORD123'
      )
    )

    expect(response.status).toBe(200)
    expect(mockCheckAdminAuth).toHaveBeenCalledWith('orders:read')
  })

  it('returns 400 for invalid query combinations', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/activity?entity=order')
    )

    expect(response.status).toBe(400)
  })

  it('returns 403 when the caller lacks permission', async () => {
    mockCheckAdminAuth.mockResolvedValue({
      authorized: false,
      error: 'Not authorized',
      status: 403,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/activity')
    )

    expect(response.status).toBe(403)
  })
})
