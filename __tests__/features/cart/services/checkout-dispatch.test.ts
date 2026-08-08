import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDbCheckoutRequestsCreate,
  mockDbCheckoutRequestsUpdateStatus,
  mockDbCheckoutRequestsClaimForProcessing,
  mockDbCheckoutRequestsFindById,
  mockDbOrdersFindFirstByCheckoutRequestId,
  mockLogBusinessEvent,
  mockLogError,
  mockLogPerformance,
  mockInngestSend,
  mockIsInngestConfigured,
  mockCreateOrderForUser,
  mockWaitUntil,
} = vi.hoisted(() => ({
  mockDbCheckoutRequestsCreate: vi.fn(),
  mockDbCheckoutRequestsUpdateStatus: vi.fn().mockResolvedValue(undefined),
  mockDbCheckoutRequestsClaimForProcessing: vi.fn().mockResolvedValue(true),
  mockDbCheckoutRequestsFindById: vi.fn().mockResolvedValue(null),
  mockDbOrdersFindFirstByCheckoutRequestId: vi.fn().mockResolvedValue(null),
  mockLogBusinessEvent: vi.fn(),
  mockLogError: vi.fn(),
  mockLogPerformance: vi.fn(),
  mockInngestSend: vi.fn(),
  mockIsInngestConfigured: vi.fn(),
  mockCreateOrderForUser: vi.fn(),
  mockWaitUntil: vi.fn(),
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: mockWaitUntil,
}))

vi.mock('@/lib/db', () => ({
  db: {
    checkoutRequests: {
      create: mockDbCheckoutRequestsCreate,
      updateStatus: mockDbCheckoutRequestsUpdateStatus,
      claimForProcessing: mockDbCheckoutRequestsClaimForProcessing,
      findById: mockDbCheckoutRequestsFindById,
      findRecentWithOrders: vi.fn().mockResolvedValue([]),
    },
    orders: {
      findFirstByCheckoutRequestId: mockDbOrdersFindFirstByCheckoutRequestId,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: mockLogError,
  logPerformance: mockLogPerformance,
  CHECKOUT_QUEUE_LAG_OPERATION: 'queue.checkout.lag',
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockInngestSend },
  isInngestConfigured: mockIsInngestConfigured,
}))

vi.mock('@/features/orders/services/order-service', () => ({
  createOrderForUser: mockCreateOrderForUser,
  isOrderRequestError: (error: unknown) =>
    error instanceof Error && 'status' in error,
}))

const mockReserveForCheckoutRequest = vi.hoisted(() =>
  vi.fn(async () => ({ granted: true, heldVariantIds: [] }))
)
const mockReleaseForCheckoutRequest = vi.hoisted(() =>
  vi.fn(async () => ({ reservations: 0, quantity: 0 }))
)

vi.mock('@/features/orders/services/stock-reservation', () => ({
  reserveForCheckoutRequest: mockReserveForCheckoutRequest,
  releaseForCheckoutRequest: mockReleaseForCheckoutRequest,
}))

vi.mock('@/lib/payments', () => ({
  ensurePaymentProviderConfigured: vi.fn(),
  PaymentConfigurationError: class PaymentConfigurationError extends Error {},
}))

import { enqueueCheckoutForUser } from '@/features/cart/services/checkout-service'

const testUser = {
  id: 'usr1234',
  name: 'Test User',
  email: 'test@example.com',
}

const checkoutBody = {
  customerName: 'Test',
  customerEmail: 'test@example.com',
  customerAddress: '123 Main Street, City, State 12345',
  addressLine1: '123 Main Street',
  addressLine2: '',
  addressLine3: '',
  pinCode: '110001',
  city: 'New Delhi',
  state: 'Delhi',
  items: [{ productId: 'abc1234', variantId: 'var0001', quantity: 1 }],
  payment: {
    provider: 'RAZORPAY',
    orderId: 'order_123',
    paymentId: 'pay_123',
    signature: 'sig_123',
  },
}

describe('checkout dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbCheckoutRequestsCreate.mockResolvedValue({
      id: 'cr9abcd',
      status: 'PENDING',
    })
    mockInngestSend.mockResolvedValue(undefined)
  })

  it('publishes an Inngest event when Inngest is configured', async () => {
    mockIsInngestConfigured.mockReturnValue(true)

    await enqueueCheckoutForUser({ body: checkoutBody, user: testUser })

    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'checkout/request.created',
        data: { checkoutRequestId: 'cr9abcd' },
      })
    )
    expect(mockWaitUntil).not.toHaveBeenCalled()
  })

  it('falls back to inline processing when Inngest is not configured', async () => {
    mockIsInngestConfigured.mockReturnValue(false)

    await enqueueCheckoutForUser({ body: checkoutBody, user: testUser })

    expect(mockInngestSend).not.toHaveBeenCalled()
    expect(mockWaitUntil).toHaveBeenCalledTimes(1)
  })

  it('falls back to inline processing when the Inngest publish fails', async () => {
    mockIsInngestConfigured.mockReturnValue(true)
    mockInngestSend.mockRejectedValue(new Error('Inngest down'))

    await enqueueCheckoutForUser({ body: checkoutBody, user: testUser })

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'checkout_dispatch_failed_using_inline_fallback',
      })
    )
    expect(mockWaitUntil).toHaveBeenCalledTimes(1)
  })

  // An unbounded publish would hold the customer's request open until the
  // platform kills it, so the inline fallback would never run.
  it('stops waiting on a hung Inngest publish and processes inline', async () => {
    vi.useFakeTimers()
    try {
      mockIsInngestConfigured.mockReturnValue(true)
      mockInngestSend.mockReturnValue(new Promise(() => {}))

      const enqueued = enqueueCheckoutForUser({
        body: checkoutBody,
        user: testUser,
      })

      await vi.advanceTimersByTimeAsync(5_000)
      await enqueued

      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'checkout_dispatch_failed_using_inline_fallback',
        })
      )
      expect(mockWaitUntil).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not leave a late publish rejection unhandled', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    vi.useFakeTimers()
    try {
      mockIsInngestConfigured.mockReturnValue(true)
      let rejectPublish: (error: Error) => void = () => {}
      mockInngestSend.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectPublish = reject
        })
      )

      const enqueued = enqueueCheckoutForUser({
        body: checkoutBody,
        user: testUser,
      })
      await vi.advanceTimersByTimeAsync(5_000)
      await enqueued

      rejectPublish(new Error('Inngest replied too late'))
      await vi.advanceTimersByTimeAsync(0)
    } finally {
      vi.useRealTimers()
      await new Promise((resolve) => setImmediate(resolve))
      process.off('unhandledRejection', unhandled)
    }

    expect(unhandled).not.toHaveBeenCalled()
  })
})
