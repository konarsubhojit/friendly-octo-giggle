import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockGetPreferences = vi.hoisted(() => vi.fn())
const mockUpdatePreferences = vi.hoisted(() => vi.fn())
const mockIsPushConfigured = vi.hoisted(() => vi.fn())
const mockGetVapidPublicKey = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/features/account/services/notification-preferences', () => ({
  getNotificationPreferences: mockGetPreferences,
  updateNotificationPreferences: mockUpdatePreferences,
}))
vi.mock('@/lib/notifications/push', () => ({
  isPushConfigured: mockIsPushConfigured,
  getVapidPublicKey: mockGetVapidPublicKey,
}))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

const preferences = {
  transactionalEmail: true,
  transactionalPush: false,
  transactionalSms: false,
  marketingEmail: false,
  marketingPush: false,
  marketingSms: false,
}

const patchRequest = (body: unknown) =>
  new Request('http://localhost/api/account/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('/api/account/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPushConfigured.mockReturnValue(true)
    mockGetVapidPublicKey.mockReturnValue('public-key')
  })

  it('rejects unauthenticated reads', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/account/notifications/route')
    expect((await GET()).status).toBe(401)
  })

  it('returns preferences and push availability', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockGetPreferences.mockResolvedValue(preferences)

    const { GET } = await import('@/app/api/account/notifications/route')
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.preferences).toEqual(preferences)
    expect(payload.data.pushEnabled).toBe(true)
    expect(payload.data.vapidPublicKey).toBe('public-key')
  })

  it('rejects unauthenticated updates', async () => {
    mockAuth.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/account/notifications/route')
    const response = await PATCH(patchRequest({ marketingEmail: true }))
    expect(response.status).toBe(401)
  })

  it('rejects an empty preference payload', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const { PATCH } = await import('@/app/api/account/notifications/route')
    const response = await PATCH(patchRequest({}))
    expect(response.status).toBe(400)
    expect(mockUpdatePreferences).not.toHaveBeenCalled()
  })

  it('persists a valid preference update', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockUpdatePreferences.mockResolvedValue({
      ...preferences,
      marketingEmail: true,
    })

    const { PATCH } = await import('@/app/api/account/notifications/route')
    const response = await PATCH(patchRequest({ marketingEmail: true }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.preferences.marketingEmail).toBe(true)
    expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', {
      marketingEmail: true,
    })
  })
})
