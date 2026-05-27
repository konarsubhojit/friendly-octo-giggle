import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())
const mockListUserAddresses = vi.hoisted(() => vi.fn())
const mockCreateUserAddress = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/features/account/services/address-service', () => ({
  listUserAddresses: mockListUserAddresses,
  createUserAddress: mockCreateUserAddress,
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

describe('GET /api/account/addresses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/account/addresses/route')
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('returns saved addresses for authenticated users', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockListUserAddresses.mockResolvedValue([
      {
        id: 'addr001',
        label: 'Home',
        addressLine1: '42 MG Road',
        addressLine2: '',
        addressLine3: '',
        pinCode: '560001',
        city: 'Bengaluru',
        state: 'Karnataka',
        isDefault: true,
      },
    ])

    const { GET } = await import('@/app/api/account/addresses/route')
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.addresses).toHaveLength(1)
  })
})

describe('POST /api/account/addresses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a saved address', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockCreateUserAddress.mockResolvedValue({
      id: 'addr001',
      label: 'Home',
      addressLine1: '42 MG Road',
      addressLine2: '',
      addressLine3: '',
      pinCode: '560001',
      city: 'Bengaluru',
      state: 'Karnataka',
      isDefault: true,
    })

    const { POST } = await import('@/app/api/account/addresses/route')
    const req = new NextRequest('http://localhost/api/account/addresses', {
      method: 'POST',
      body: JSON.stringify({
        label: 'Home',
        addressLine1: '42 MG Road',
        pinCode: '560001',
        city: 'Bengaluru',
        state: 'Karnataka',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(201)
  })
})
