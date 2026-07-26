import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockInsert,
  mockDelete,
  mockUpdate,
  mockTransaction,
  mockTxSelect,
  mockVerifyRazorpayWebhookSignature,
  mockProcessCheckoutRequestById,
  mockSet,
  mockGetPaymentGateway,
  PaymentVerificationError,
  PaymentConfigurationError,
} = vi.hoisted(() => {
  class PaymentVerificationError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.status = status
    }
  }

  class PaymentConfigurationError extends Error {
    status: number
    constructor(message: string, status = 503) {
      super(message)
      this.status = status
    }
  }

  return {
    mockInsert: vi.fn(),
    mockDelete: vi.fn(),
    mockUpdate: vi.fn(),
    mockTransaction: vi.fn(),
    mockTxSelect: vi.fn(),
    mockVerifyRazorpayWebhookSignature: vi.fn(),
    mockProcessCheckoutRequestById: vi.fn(),
    mockSet: vi.fn(),
    mockGetPaymentGateway: vi.fn(),
    PaymentVerificationError,
    PaymentConfigurationError,
  }
})

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: {
    insert: mockInsert,
    delete: mockDelete,
    update: mockUpdate,
    transaction: mockTransaction,
  },
}))

vi.mock('@/lib/schema', () => ({
  checkoutRequests: {
    id: 'id',
    status: 'status',
    paymentTransactionId: 'paymentTransactionId',
    paymentOrderId: 'paymentOrderId',
  },
  orders: {
    id: 'id',
    paymentStatus: 'paymentStatus',
    paymentTransactionId: 'paymentTransactionId',
  },
  webhookEvents: {
    id: 'id',
    provider: 'provider',
    eventId: 'eventId',
    receivedAt: 'receivedAt',
    processedAt: 'processedAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => args),
  eq: vi.fn((...args) => args),
  ne: vi.fn((...args) => args),
  lt: vi.fn((...args) => args),
  isNull: vi.fn((...args) => args),
}))

vi.mock('@/lib/payments', () => ({
  getPaymentGateway: mockGetPaymentGateway,
  verifyRazorpayWebhookSignature: mockVerifyRazorpayWebhookSignature,
  PaymentVerificationError,
  PaymentConfigurationError,
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  processCheckoutRequestById: mockProcessCheckoutRequestById,
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

import { POST } from '@/app/api/payments/webhook/route'
import { POST as POST_BY_PROVIDER } from '@/app/api/payments/webhook/[provider]/route'

/**
 * Stand-in for the Razorpay gateway: verifies the delivery signature and
 * normalizes the payload exactly as the real implementation does, so the route
 * is exercised through the provider-agnostic gateway contract.
 */
const razorpayGatewayStub = {
  provider: 'RAZORPAY' as const,
  verifyWebhook: ({
    payload,
    headers,
  }: {
    payload: string
    headers: Headers
  }) => {
    const signature = headers.get('x-razorpay-signature')
    if (!signature) {
      throw new PaymentVerificationError('Missing webhook signature')
    }

    mockVerifyRazorpayWebhookSignature({ payload, signature })

    let body: {
      event?: string
      payload?: {
        payment?: {
          entity?: { id?: string; order_id?: string; amount?: number }
        }
      }
    }
    try {
      body = JSON.parse(payload)
    } catch {
      throw new PaymentVerificationError('Invalid webhook payload')
    }

    const entity = body.payload?.payment?.entity
    if (!entity?.id || !entity.order_id) {
      throw new PaymentVerificationError('Invalid payment webhook payload')
    }

    const eventType = body.event ?? ''
    if (eventType === 'payment.captured' && typeof entity.amount !== 'number') {
      throw new PaymentVerificationError(
        'Invalid payment amount in webhook payload'
      )
    }

    return {
      provider: 'RAZORPAY' as const,
      eventId:
        headers.get('x-razorpay-event-id')?.trim() ||
        `${eventType}:${entity.id}`,
      eventType,
      type:
        eventType === 'payment.captured' || eventType === 'payment.failed'
          ? eventType
          : ('unhandled' as const),
      paymentId: entity.id,
      paymentOrderId: entity.order_id,
      amountInMinorUnits:
        typeof entity.amount === 'number' ? entity.amount : null,
    }
  },
}

/** Queue the rows returned by successive `tx.select(...)` calls. */
const queueTransactionSelects = (results: unknown[][]) => {
  mockTxSelect.mockReset()
  for (const result of results) {
    mockTxSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValue(result),
    } as never)
  }
}

const buildRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/payments/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-razorpay-signature': 'valid_signature', ...headers },
  })

const capturedEvent = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: { id: 'pay_123', order_id: 'order_123', amount: 19900 },
    },
  },
}

/** Simulate the unique-constraint dedupe: only the first insert returns a row. */
const useEventClaimSequence = (claims: boolean[]) => {
  mockInsert.mockReset()
  for (const claimed of claims) {
    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(claimed ? [{ id: 'evt_1' }] : []),
    } as never)
  }
}

/**
 * `update().set().where()` is awaited directly by some call sites and chained
 * with `.returning()` by the reclaim path, so the stub must support both.
 */
const updateResult = (rows: unknown[]) =>
  Object.assign(Promise.resolve(rows), {
    returning: vi.fn().mockResolvedValue(rows),
  })

/** Rows returned when the handler tries to reclaim a stale, unprocessed claim. */
const useReclaimResult = (rows: unknown[]) => {
  mockUpdate.mockReturnValue({
    set: mockSet.mockReturnValue({
      where: vi.fn(() => updateResult(rows)),
    }),
  })
}

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPaymentGateway.mockImplementation((provider: string) => {
      if (provider !== 'RAZORPAY') {
        throw new PaymentConfigurationError('Unsupported payment provider', 400)
      }
      return razorpayGatewayStub
    })
    useReclaimResult([])
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ select: mockTxSelect, update: mockUpdate })
    )
    useEventClaimSequence([true])
  })

  it('returns 400 when signature header is missing', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
  })

  it('processes captured payment event', async () => {
    queueTransactionSelects([[], [{ id: 'chk_123', status: 'PENDING' }]])

    const response = await POST(buildRequest(capturedEvent))

    expect(response.status).toBe(200)
    expect(mockVerifyRazorpayWebhookSignature).toHaveBeenCalled()
    expect(mockProcessCheckoutRequestById).toHaveBeenCalledWith('chk_123')
  })

  it('marks an existing order as paid without reprocessing checkout', async () => {
    queueTransactionSelects([[{ id: 'ord_1', paymentStatus: 'PENDING' }]])

    const response = await POST(buildRequest(capturedEvent))

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockProcessCheckoutRequestById).not.toHaveBeenCalled()
  })

  it('ignores a duplicate delivery of the same event', async () => {
    useEventClaimSequence([false])

    const response = await POST(
      buildRequest(capturedEvent, { 'x-razorpay-event-id': 'evt_dup' })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      duplicate: true,
    })
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockProcessCheckoutRequestById).not.toHaveBeenCalled()
  })

  it('processes concurrent deliveries of the same event exactly once', async () => {
    useEventClaimSequence([true, false])
    queueTransactionSelects([[], [{ id: 'chk_123', status: 'PENDING' }]])

    const responses = await Promise.all([
      POST(buildRequest(capturedEvent, { 'x-razorpay-event-id': 'evt_1' })),
      POST(buildRequest(capturedEvent, { 'x-razorpay-event-id': 'evt_1' })),
    ])

    expect(responses.map((r) => r.status)).toEqual([200, 200])
    expect(mockProcessCheckoutRequestById).toHaveBeenCalledTimes(1)
  })

  it('skips checkout requests that are already being processed', async () => {
    queueTransactionSelects([[], [{ id: 'chk_123', status: 'PROCESSING' }]])

    const response = await POST(buildRequest(capturedEvent))

    expect(response.status).toBe(200)
    expect(mockProcessCheckoutRequestById).not.toHaveBeenCalled()
  })

  it('releases the event claim when processing fails', async () => {
    queueTransactionSelects([[], [{ id: 'chk_123', status: 'PENDING' }]])
    mockProcessCheckoutRequestById.mockRejectedValueOnce(new Error('boom'))

    const response = await POST(buildRequest(capturedEvent))

    expect(response.status).toBe(500)
    expect(mockDelete).toHaveBeenCalled()
  })

  it('reclaims a stale claim whose processing never completed', async () => {
    useEventClaimSequence([false])
    useReclaimResult([{ id: 'evt_stale' }])
    queueTransactionSelects([[], [{ id: 'chk_123', status: 'PENDING' }]])

    const response = await POST(
      buildRequest(capturedEvent, { 'x-razorpay-event-id': 'evt_stale' })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mockProcessCheckoutRequestById).toHaveBeenCalledWith('chk_123')
  })

  it('records processedAt once the side effects commit', async () => {
    queueTransactionSelects([[], [{ id: 'chk_123', status: 'PENDING' }]])

    await POST(buildRequest(capturedEvent))

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ processedAt: expect.any(Date) })
    )
  })

  it('returns 400 for a body that is not valid JSON', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/payments/webhook', {
        method: 'POST',
        body: 'not-json',
        headers: { 'x-razorpay-signature': 'valid_signature' },
      })
    )

    expect(response.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('rejects a captured event without an amount', async () => {
    const response = await POST(
      buildRequest({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_123', order_id: 'order_123' } },
        },
      })
    )

    expect(response.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('dispatches a provider-scoped delivery to the matching gateway', async () => {
    queueTransactionSelects([[], [{ id: 'chk_123', status: 'PENDING' }]])

    const response = await POST_BY_PROVIDER(buildRequest(capturedEvent), {
      params: Promise.resolve({ provider: 'razorpay' }),
    })

    expect(response.status).toBe(200)
    expect(mockGetPaymentGateway).toHaveBeenCalledWith('RAZORPAY')
    expect(mockProcessCheckoutRequestById).toHaveBeenCalledWith('chk_123')
  })

  it('rejects a delivery for an unregistered provider', async () => {
    const response = await POST_BY_PROVIDER(buildRequest(capturedEvent), {
      params: Promise.resolve({ provider: 'stripe' }),
    })

    expect(response.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('marks failed payments as failed', async () => {
    const response = await POST(
      buildRequest({
        event: 'payment.failed',
        payload: {
          payment: { entity: { id: 'pay_123', order_id: 'order_123' } },
        },
      })
    )

    expect(response.status).toBe(200)
    // checkout request + order marked failed, then the event marked processed
    expect(mockUpdate).toHaveBeenCalledTimes(3)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' })
    )
  })
})
