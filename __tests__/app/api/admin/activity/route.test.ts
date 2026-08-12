import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/admin/activity/route'

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminAuth: vi.fn(),
}))
vi.mock(
  '@/features/admin/services/admin-activity-query',
  async (importOriginal) => {
    // Keep `getAllowedActivityEntities` real: it is the pure, security-critical
    // permission-scoping logic exercised by the "no records for an
    // unpermitted entity" test below (FR-D09, scenario 6). Only the
    // DB-touching functions are stubbed.
    const actual = await importOriginal<
      typeof import('@/features/admin/services/admin-activity-query')
    >()
    return {
      ...actual,
      getActivityRequiredPermission: vi.fn(),
      queryAdminActivity: vi.fn(),
    }
  }
)
vi.mock('@/lib/constants/roles', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/constants/roles')>()
  return {
    ...actual,
    getRolePermissions: vi.fn(actual.getRolePermissions),
  }
})

import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  getActivityRequiredPermission,
  getAllowedActivityEntities,
  queryAdminActivity,
} from '@/features/admin/services/admin-activity-query'
import { getRolePermissions } from '@/lib/constants/roles'

const mockCheckAdminAuth = vi.mocked(checkAdminAuth)
const mockGetActivityRequiredPermission = vi.mocked(
  getActivityRequiredPermission
)
const mockQueryAdminActivity = vi.mocked(queryAdminActivity)
const mockGetRolePermissions = vi.mocked(getRolePermissions)

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
          changes: [
            { field: 'status', before: 'PROCESSING', after: 'SHIPPED' },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      nextCursor: 'cursor-1',
    })

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/activity?action=status_change'
      )
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

  it('scopes the global activity view to entities the caller may read, excluding entities without permission (FR-D09, scenario 6)', async () => {
    // A hypothetical role that can see the global activity view
    // (`system:manage`) but was never granted `reviews:moderate`. No
    // built-in role currently matches this shape (ADMIN holds every
    // permission), so `getRolePermissions` is stubbed to simulate one and
    // exercise the fail-closed entity scoping in isolation.
    const restrictedPermissions = [
      'system:manage',
      'orders:read',
    ] as const
    mockGetRolePermissions.mockReturnValue(restrictedPermissions)
    mockCheckAdminAuth.mockResolvedValue({
      authorized: true,
      userId: 'restricted-1',
      role: 'ADMIN',
    })

    const allEntries = [
      { id: 'log-order', entity: 'order' },
      { id: 'log-review', entity: 'review' },
      { id: 'log-product', entity: 'product' },
    ]
    mockQueryAdminActivity.mockImplementation(async ({ permissions }) => {
      const allowedEntities = getAllowedActivityEntities(permissions)
      return {
        entries: allEntries
          .filter((entry) => allowedEntities.includes(entry.entity))
          .map((entry) => ({
            ...entry,
            entityId: 'irrelevant',
            action: 'status_change',
            actor: { userId: 'restricted-1', role: 'ADMIN' },
            changes: [],
            createdAt: '2026-01-01T00:00:00.000Z',
          })),
        nextCursor: null,
      }
    })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/activity')
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockQueryAdminActivity).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: restrictedPermissions })
    )
    const returnedEntities = (
      payload.data.entries as Array<{ entity: string }>
    ).map((entry) => entry.entity)
    expect(returnedEntities).toContain('order')
    expect(returnedEntities).not.toContain('review')
    expect(returnedEntities).not.toContain('product')
  })
})
