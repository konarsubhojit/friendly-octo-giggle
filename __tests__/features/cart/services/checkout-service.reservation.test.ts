/**
 * The oversell reproduction, at the seam where it used to happen.
 *
 * Two shoppers submit checkouts for the same last unit. Before reservations,
 * both requests were accepted and both reached the durable pipeline, where the
 * loser failed *after* its payment had been accepted. Now the second request
 * is refused at acceptance, before it can be queued.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDbCheckoutRequestsCreate,
  mockDbCheckoutRequestsUpdateStatus,
  mockDbCheckoutRequestsFindById,
  mockDbOrdersFindFirstByCheckoutRequestId,
  mockLogBusinessEvent,
  mockLogError,
  mockInngestSend,
  mockReserveForCheckoutRequest,
  mockReleaseForCheckoutRequest,
} = vi.hoisted(() => ({
  mockDbCheckoutRequestsCreate: vi.fn(),
  mockDbCheckoutRequestsUpdateStatus: vi.fn().mockResolvedValue(undefined),
  mockDbCheckoutRequestsFindById: vi.fn().mockResolvedValue(null),
  mockDbOrdersFindFirstByCheckoutRequestId: vi.fn().mockResolvedValue(null),
  mockLogBusinessEvent: vi.fn(),
  mockLogError: vi.fn(),
  mockInngestSend: vi.fn().mockResolvedValue(undefined),
  mockReserveForCheckoutRequest: vi.fn(),
  mockReleaseForCheckoutRequest: vi
    .fn()
    .mockResolvedValue({ reservations: 1, quantity: 1 }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    checkoutRequests: {
      create: mockDbCheckoutRequestsCreate,
      updateStatus: mockDbCheckoutRequestsUpdateStatus,
      claimForProcessing: vi.fn().mockResolvedValue(true),
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
  logPerformance: vi.fn(),
  CHECKOUT_QUEUE_LAG_OPERATION: 'queue.checkout.lag',
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockInngestSend },
  isInngestConfigured: () => true,
}))

vi.mock('@/features/orders/services/order-service', () => ({
  createOrderForUser: vi.fn(),
  isOrderRequestError: (error: unknown) =>
    error instanceof Error && 'status' in error,
}))

vi.mock('@/features/orders/services/stock-reservation', () => ({
  reserveForCheckoutRequest: mockReserveForCheckoutRequest,
  releaseForCheckoutRequest: mockReleaseForCheckoutRequest,
}))

vi.mock('@/lib/payments', () => ({
  ensurePaymentProviderConfigured: vi.fn(),
  PaymentConfigurationError: class PaymentConfigurationError extends Error {
    status = 503
  },
}))

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))

import {
  enqueueCheckoutForUser,
  isCheckoutRequestError,
  recordCheckoutProcessingFailure,
  recoverCheckoutRequestAfterRetryExhaustion,
} from '@/features/cart/services/checkout-service'

const user = { id: 'user1', name: 'Test User', email: 'test@example.com' }

const body = {
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
  payment: { provider: 'COD' as const },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDbCheckoutRequestsUpdateStatus.mockResolvedValue(undefined)
  mockInngestSend.mockResolvedValue(undefined)
  mockReleaseForCheckoutRequest.mockResolvedValue({
    reservations: 1,
    quantity: 1,
  })
})

describe('checkout acceptance holds stock', () => {
  it('holds the requested units for the winner and queues it', async () => {
    mockDbCheckoutRequestsCreate.mockResolvedValue({
      id: 'cr1abcd',
      status: 'PENDING',
    })
    mockReserveForCheckoutRequest.mockResolvedValue({
      granted: true,
      heldVariantIds: ['var0001'],
    })

    const result = await enqueueCheckoutForUser({ body, user })

    expect(mockReserveForCheckoutRequest).toHaveBeenCalledWith({
      checkoutRequestId: 'cr1abcd',
      items: body.items,
    })
    expect(result.checkoutRequestId).toBe('cr1abcd')
    expect(mockInngestSend).toHaveBeenCalled()
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'checkout_reservation_granted',
        success: true,
      })
    )
  })

  it('refuses the loser with a 409 naming the unavailable item', async () => {
    mockDbCheckoutRequestsCreate.mockResolvedValue({
      id: 'cr2abcd',
      status: 'PENDING',
    })
    mockReserveForCheckoutRequest.mockResolvedValue({
      granted: false,
      unavailableVariantIds: ['var0001'],
    })

    const error = await enqueueCheckoutForUser({ body, user }).catch(
      (thrown: unknown) => thrown
    )

    expect(isCheckoutRequestError(error)).toBe(true)
    expect((error as { status: number }).status).toBe(409)
    expect((error as Error).message).toContain('var0001')
  })

  it('never queues a refused request', async () => {
    mockDbCheckoutRequestsCreate.mockResolvedValue({
      id: 'cr3abcd',
      status: 'PENDING',
    })
    mockReserveForCheckoutRequest.mockResolvedValue({
      granted: false,
      unavailableVariantIds: ['var0001'],
    })

    await expect(enqueueCheckoutForUser({ body, user })).rejects.toThrow()

    expect(mockInngestSend).not.toHaveBeenCalled()
    expect(mockDbCheckoutRequestsUpdateStatus).toHaveBeenCalledWith(
      'cr3abcd',
      'FAILED',
      expect.stringContaining('var0001')
    )
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'checkout_reservation_denied',
        success: false,
      })
    )
  })
})

describe('failed checkouts give their units back', () => {
  it('releases on a terminal processing failure', async () => {
    const clientError = Object.assign(new Error('Insufficient stock'), {
      status: 400,
    })

    const { terminal } = await recordCheckoutProcessingFailure(
      'cr4abcd',
      clientError
    )

    expect(terminal).toBe(true)
    expect(mockReleaseForCheckoutRequest).toHaveBeenCalledWith({
      checkoutRequestId: 'cr4abcd',
      reason: 'checkout_failed',
    })
  })

  it('keeps the hold while a transient failure will be retried', async () => {
    const { terminal } = await recordCheckoutProcessingFailure(
      'cr5abcd',
      new Error('database unreachable')
    )

    expect(terminal).toBe(false)
    expect(mockReleaseForCheckoutRequest).not.toHaveBeenCalled()
  })

  it('releases when retries are exhausted', async () => {
    await recoverCheckoutRequestAfterRetryExhaustion({
      checkoutRequestId: 'cr6abcd',
      deliveryCount: 4,
      error: new Error('gave up'),
    })

    expect(mockReleaseForCheckoutRequest).toHaveBeenCalledWith({
      checkoutRequestId: 'cr6abcd',
      reason: 'retry_exhausted',
    })
  })

  it('does not release the hold of a request that already succeeded', async () => {
    mockDbOrdersFindFirstByCheckoutRequestId.mockResolvedValueOnce({
      id: 'order1',
    })

    await recoverCheckoutRequestAfterRetryExhaustion({
      checkoutRequestId: 'cr7abcd',
      deliveryCount: 4,
      error: new Error('gave up'),
    })

    expect(mockReleaseForCheckoutRequest).not.toHaveBeenCalled()
  })

  it('lets the expiry sweep clean up when the release itself fails', async () => {
    mockReleaseForCheckoutRequest.mockRejectedValueOnce(
      new Error('connection reset')
    )
    const clientError = Object.assign(new Error('Insufficient stock'), {
      status: 400,
    })

    await expect(
      recordCheckoutProcessingFailure('cr8abcd', clientError)
    ).resolves.toEqual({ terminal: true })

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'checkout_reservation_release_failed',
      })
    )
  })
})
