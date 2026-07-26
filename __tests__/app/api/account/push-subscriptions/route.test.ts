import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockSaveSubscription = vi.hoisted(() => vi.fn())
const mockDeleteSubscription = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/features/account/services/push-subscription-service', () => ({
  savePushSubscription: mockSaveSubscription,
  deletePushSubscription: mockDeleteSubscription,
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

const validSubscription = {
  endpoint: 'https://push.example.com/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
}

const makeRequest = (method: string, body: unknown) =>
  new Request('http://localhost/api/account/push-subscriptions', {
    method,
    headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest' },
    body: JSON.stringify(body),
  })

describe('/api/account/push-subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated subscribe requests', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/account/push-subscriptions/route')
    const response = await POST(makeRequest('POST', validSubscription))
    expect(response.status).toBe(401)
  })

  it('stores a valid subscription for the caller', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const { POST } = await import('@/app/api/account/push-subscriptions/route')
    const response = await POST(makeRequest('POST', validSubscription))

    expect(response.status).toBe(201)
    expect(mockSaveSubscription).toHaveBeenCalledWith(
      'user-1',
      validSubscription,
      'vitest'
    )
  })

  it('rejects non-HTTPS endpoints', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const { POST } = await import('@/app/api/account/push-subscriptions/route')
    const response = await POST(
      makeRequest('POST', {
        ...validSubscription,
        endpoint: 'http://push.example.com/abc',
      })
    )

    expect(response.status).toBe(400)
    expect(mockSaveSubscription).not.toHaveBeenCalled()
  })

  it('removes a revoked subscription owned by the caller', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const { DELETE } = await import(
      '@/app/api/account/push-subscriptions/route'
    )
    const response = await DELETE(
      makeRequest('DELETE', { endpoint: validSubscription.endpoint })
    )

    expect(response.status).toBe(200)
    expect(mockDeleteSubscription).toHaveBeenCalledWith(
      'user-1',
      validSubscription.endpoint
    )
  })
})
