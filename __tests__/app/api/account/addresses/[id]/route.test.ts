import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())
const mockUpdateUserAddress = vi.hoisted(() => vi.fn())
const mockDeleteUserAddress = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/features/account/services/address-service', () => ({
  updateUserAddress: mockUpdateUserAddress,
  deleteUserAddress: mockDeleteUserAddress,
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

describe('PATCH /api/account/addresses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when address does not exist', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockUpdateUserAddress.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/account/addresses/[id]/route')

    const req = new NextRequest('http://localhost/api/account/addresses/addr001', {
      method: 'PATCH',
      body: JSON.stringify({ label: 'Updated home' }),
    })

    const response = await PATCH(req, { params: Promise.resolve({ id: 'addr001' }) })
    expect(response.status).toBe(404)
  })
})

describe('DELETE /api/account/addresses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes an address when found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockDeleteUserAddress.mockResolvedValue(true)
    const { DELETE } = await import('@/app/api/account/addresses/[id]/route')

    const req = new NextRequest('http://localhost/api/account/addresses/addr001', {
      method: 'DELETE',
    })

    const response = await DELETE(req, {
      params: Promise.resolve({ id: 'addr001' }),
    })
    expect(response.status).toBe(200)
  })
})
