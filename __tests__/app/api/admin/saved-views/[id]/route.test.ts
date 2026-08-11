import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE, PATCH } from '@/app/api/admin/saved-views/[id]/route'

vi.mock('@/features/admin/services/admin-auth', () => ({
  checkAdminSessionAuth: vi.fn(),
}))
vi.mock('@/features/admin/services/saved-views', () => ({
  getOwnedSavedViewById: vi.fn(),
  renameSavedView: vi.fn(),
  deleteSavedView: vi.fn(),
}))

import { checkAdminSessionAuth } from '@/features/admin/services/admin-auth'
import {
  deleteSavedView,
  getOwnedSavedViewById,
  renameSavedView,
} from '@/features/admin/services/saved-views'

const mockCheckAdminSessionAuth = vi.mocked(checkAdminSessionAuth)
const mockGetOwnedSavedViewById = vi.mocked(getOwnedSavedViewById)
const mockRenameSavedView = vi.mocked(renameSavedView)
const mockDeleteSavedView = vi.mocked(deleteSavedView)

const sessionAuth = {
  authorized: true as const,
  userId: 'admin-1',
  role: 'ADMIN' as const,
  permissions: ['orders:read'] as const,
}

const makeParams = (id = 'sv1') => ({ params: Promise.resolve({ id }) })

describe('/api/admin/saved-views/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAdminSessionAuth.mockResolvedValue(sessionAuth)
  })

  it('renames an owned saved view', async () => {
    mockGetOwnedSavedViewById.mockResolvedValue({
      id: 'sv1',
      resource: 'orders',
      ownerId: 'admin-1',
      isBuiltIn: false,
    } as never)
    mockRenameSavedView.mockResolvedValue({
      id: 'sv1',
      resource: 'orders',
      name: 'Needs attention',
      criteria: {},
      isBuiltIn: false,
      owned: true,
    })

    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/saved-views/sv1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Needs attention' }),
      }),
      makeParams()
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.view.name).toBe('Needs attention')
  })

  it('deletes an owned saved view', async () => {
    mockGetOwnedSavedViewById.mockResolvedValue({
      id: 'sv1',
      resource: 'orders',
      ownerId: 'admin-1',
      isBuiltIn: false,
    } as never)
    mockDeleteSavedView.mockResolvedValue(true)

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/saved-views/sv1', {
        method: 'DELETE',
      }),
      makeParams()
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.deleted).toBe(true)
  })

  it('returns 404 for an unknown saved view', async () => {
    mockGetOwnedSavedViewById.mockResolvedValue(null)

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/saved-views/unknown', {
        method: 'DELETE',
      }),
      makeParams('unknown')
    )

    expect(response.status).toBe(404)
  })
})
