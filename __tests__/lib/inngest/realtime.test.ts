import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockPublish,
  mockSubscribe,
  mockIsInngestConfigured,
  mockLogError,
  mockRaceWithTimeout,
} = vi.hoisted(() => ({
  mockPublish: vi.fn(),
  mockSubscribe: vi.fn(),
  mockIsInngestConfigured: vi.fn(),
  mockLogError: vi.fn(),
  mockRaceWithTimeout: vi.fn(),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { realtime: { publish: mockPublish, subscribe: mockSubscribe } },
  isInngestConfigured: mockIsInngestConfigured,
}))

vi.mock('@/lib/inngest/dispatch', () => ({
  raceWithTimeout: mockRaceWithTimeout,
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

import {
  CheckoutStatusMessageSchema,
  checkoutChannel,
  isTerminalCheckoutStatus,
  publishCheckoutStatus,
  subscribeToCheckoutStatus,
} from '@/lib/inngest/realtime'

const COMPLETED = {
  checkoutRequestId: 'chk1234',
  status: 'COMPLETED' as const,
  orderId: 'ORDabc1234',
  error: null,
}

describe('checkout realtime channel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsInngestConfigured.mockReturnValue(true)
    mockRaceWithTimeout.mockImplementation(
      async (operation: Promise<unknown>) => {
        await operation
      }
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('scopes the channel to a single checkout request', () => {
    expect(checkoutChannel('chk1234').name).toBe('checkout:chk1234')
  })

  it('accepts a settled status payload', () => {
    expect(CheckoutStatusMessageSchema.safeParse(COMPLETED).success).toBe(true)
  })

  it('rejects a payload whose id is not a short id', () => {
    expect(
      CheckoutStatusMessageSchema.safeParse({ ...COMPLETED, checkoutRequestId: 'x' })
        .success
    ).toBe(false)
  })

  it.each([
    ['COMPLETED', true],
    ['FAILED', true],
    ['PENDING', false],
    ['PROCESSING', false],
  ])('treats %s as terminal=%s', (status, expected) => {
    expect(isTerminalCheckoutStatus(status)).toBe(expected)
  })
})

describe('publishCheckoutStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsInngestConfigured.mockReturnValue(true)
    mockRaceWithTimeout.mockImplementation(
      async (operation: Promise<unknown>) => {
        await operation
      }
    )
    mockPublish.mockResolvedValue(undefined)
  })

  it('publishes a settled status on the request channel', async () => {
    await expect(publishCheckoutStatus(COMPLETED)).resolves.toBe(true)

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'checkout:chk1234', topic: 'status' }),
      COMPLETED
    )
  })

  it('publishes through the shared timeout budget', async () => {
    await publishCheckoutStatus(COMPLETED)

    expect(mockRaceWithTimeout).toHaveBeenCalledTimes(1)
  })

  it('skips publishing when Inngest is not configured', async () => {
    mockIsInngestConfigured.mockReturnValue(false)

    await expect(publishCheckoutStatus(COMPLETED)).resolves.toBe(false)
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it.each(['PENDING', 'PROCESSING'] as const)(
    'does not publish the intermediate %s status',
    async (status) => {
      await expect(
        publishCheckoutStatus({ ...COMPLETED, status, orderId: null })
      ).resolves.toBe(false)
      expect(mockPublish).not.toHaveBeenCalled()
    }
  )

  it('swallows and logs a publish failure', async () => {
    mockPublish.mockRejectedValue(new Error('realtime down'))

    await expect(publishCheckoutStatus(COMPLETED)).resolves.toBe(false)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'checkout_realtime_publish_failed' })
    )
  })
})

describe('subscribeToCheckoutStatus', () => {
  const onMessage = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsInngestConfigured.mockReturnValue(true)
  })

  it('returns null when Inngest is not configured', async () => {
    mockIsInngestConfigured.mockReturnValue(false)

    await expect(
      subscribeToCheckoutStatus({ checkoutRequestId: 'chk1234', onMessage })
    ).resolves.toBeNull()
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('forwards a valid message to the caller', async () => {
    const subscription = { close: vi.fn() }
    mockSubscribe.mockImplementation(async (options) => {
      options.onMessage({ data: COMPLETED })
      return subscription
    })

    await expect(
      subscribeToCheckoutStatus({ checkoutRequestId: 'chk1234', onMessage })
    ).resolves.toBe(subscription)
    expect(onMessage).toHaveBeenCalledWith(COMPLETED)
  })

  it('drops a message that does not match the schema', async () => {
    mockSubscribe.mockImplementation(async (options) => {
      options.onMessage({ data: { status: 'COMPLETED' } })
      return { close: vi.fn() }
    })

    await subscribeToCheckoutStatus({ checkoutRequestId: 'chk1234', onMessage })

    expect(onMessage).not.toHaveBeenCalled()
  })

  it('logs a subscription error without ending the subscription', async () => {
    mockSubscribe.mockImplementation(async (options) => {
      options.onError(new Error('socket closed'))
      return { close: vi.fn() }
    })

    await subscribeToCheckoutStatus({ checkoutRequestId: 'chk1234', onMessage })

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'checkout_realtime_subscribe_error' })
    )
  })

  it('returns null when the connection cannot be opened', async () => {
    mockSubscribe.mockRejectedValue(new Error('no websocket'))

    await expect(
      subscribeToCheckoutStatus({ checkoutRequestId: 'chk1234', onMessage })
    ).resolves.toBeNull()
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'checkout_realtime_subscribe_failed' })
    )
  })
})
