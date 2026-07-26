import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendNotification = vi.hoisted(() => vi.fn())
const mockSetVapidDetails = vi.hoisted(() => vi.fn())
const mockListPushSubscriptions = vi.hoisted(() => vi.fn())
const mockDeleteByEndpoint = vi.hoisted(() => vi.fn())
const mockEnv = vi.hoisted(() => ({
  VAPID_PUBLIC_KEY: 'public-key' as string | undefined,
  VAPID_PRIVATE_KEY: 'private-key' as string | undefined,
  VAPID_SUBJECT: 'mailto:ops@example.com' as string | undefined,
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}))
vi.mock('@/lib/env', () => ({
  get env() {
    return mockEnv
  },
}))
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/features/account/services/push-subscription-service', () => ({
  listPushSubscriptions: mockListPushSubscriptions,
  deletePushSubscriptionByEndpoint: mockDeleteByEndpoint,
}))

const subscription = {
  id: 'sub0001',
  endpoint: 'https://push.example.com/abc',
  p256dh: 'p256dh-key',
  auth: 'auth-key',
}

const loadModule = async () => import('@/lib/notifications/push')

describe('web push sender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockEnv.VAPID_PUBLIC_KEY = 'public-key'
    mockEnv.VAPID_PRIVATE_KEY = 'private-key'
  })

  it('reports configuration state from the VAPID keys', async () => {
    const { isPushConfigured, getVapidPublicKey } = await loadModule()
    expect(isPushConfigured()).toBe(true)
    expect(getVapidPublicKey()).toBe('public-key')
  })

  it('skips sending when VAPID keys are missing', async () => {
    mockEnv.VAPID_PRIVATE_KEY = undefined
    const { sendPushToUser } = await loadModule()
    await expect(
      sendPushToUser('user-1', { title: 'Hi', body: 'There' })
    ).resolves.toBe(0)
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('delivers to every stored subscription', async () => {
    mockListPushSubscriptions.mockResolvedValue([subscription])
    mockSendNotification.mockResolvedValue(undefined)
    const { sendPushToUser } = await loadModule()

    const sent = await sendPushToUser('user-1', {
      title: 'Order shipped',
      body: 'On its way',
      url: '/orders/abc',
    })

    expect(sent).toBe(1)
    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      'mailto:ops@example.com',
      'public-key',
      'private-key'
    )
    const [target, payload] = mockSendNotification.mock.calls[0]
    expect(target.endpoint).toBe(subscription.endpoint)
    expect(JSON.parse(payload).title).toBe('Order shipped')
  })

  it('removes subscriptions the push service reports as gone', async () => {
    mockListPushSubscriptions.mockResolvedValue([subscription])
    mockSendNotification.mockRejectedValue({ statusCode: 410 })
    const { sendPushToUser } = await loadModule()

    const sent = await sendPushToUser('user-1', { title: 'x', body: 'y' })

    expect(sent).toBe(0)
    expect(mockDeleteByEndpoint).toHaveBeenCalledWith(subscription.endpoint)
  })

  it('keeps subscriptions on transient failures', async () => {
    mockListPushSubscriptions.mockResolvedValue([subscription])
    mockSendNotification.mockRejectedValue({ statusCode: 500 })
    const { sendPushToUser } = await loadModule()

    await expect(
      sendPushToUser('user-1', { title: 'x', body: 'y' })
    ).resolves.toBe(0)
    expect(mockDeleteByEndpoint).not.toHaveBeenCalled()
  })
})
