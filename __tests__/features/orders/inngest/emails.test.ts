import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDeliverConfirmation,
  mockDeliverStatus,
  mockDeliverRefund,
  mockSaveFailedEmail,
  mockLogError,
} = vi.hoisted(() => ({
  mockDeliverConfirmation: vi.fn(),
  mockDeliverStatus: vi.fn(),
  mockDeliverRefund: vi.fn(),
  mockSaveFailedEmail: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/notifications/order-notifications', () => ({
  deliverOrderConfirmationNotification: mockDeliverConfirmation,
  deliverOrderRefundNotification: mockDeliverRefund,
  deliverOrderStatusNotification: mockDeliverStatus,
}))

vi.mock('@/lib/email/failed-emails', () => ({
  saveFailedEmail: mockSaveFailedEmail,
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  EMAIL_FUNCTION_RETRIES,
  sendOrderConfirmationEmailFunction,
  sendOrderRefundEmailFunction,
  sendOrderStatusEmailFunction,
} from '@/features/orders/inngest/emails'

type FnInternals = {
  opts: { id: string; retries?: number; idempotency?: string }
  fn: (ctx: unknown) => Promise<unknown>
  onFailureFn?: (ctx: unknown) => Promise<unknown>
}

const internals = (fn: unknown) => fn as unknown as FnInternals

const createStep = () => {
  const scores: { name: string; value: number | boolean }[] = []
  return {
    scores,
    step: {
      run: async <T>(_id: string, handler: () => T | Promise<T>) => handler(),
      score: async (
        _id: string,
        score: { name: string; value: number | boolean }
      ) => {
        scores.push(score)
      },
    },
  }
}

const DELIVERED = {
  emailSuppressed: false,
  emailDelivered: true,
  usedFallbackProvider: false,
}

const CONFIRMATION_EVENT = {
  data: {
    orderId: 'ord1234',
    userId: 'user1',
    checkoutRequestId: 'cr12345',
    customerEmail: 'customer@example.com',
    customerName: 'Test User',
    customerAddress: '123 Street',
    subtotalAmount: 200,
    shippingAmount: 0,
    taxAmount: 0,
    shippingMethod: 'STANDARD',
    totalAmount: 200,
    discountAmount: undefined,
    couponCode: null,
    currencyCode: 'INR',
    items: [{ name: 'Widget', quantity: 2, price: 100 }],
    productIds: ['p1'],
  },
}

describe('order email functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeliverConfirmation.mockResolvedValue(DELIVERED)
    mockDeliverStatus.mockResolvedValue(DELIVERED)
    mockDeliverRefund.mockResolvedValue(DELIVERED)
  })

  it('dedupes a confirmation on the order id alone', () => {
    const { opts } = internals(sendOrderConfirmationEmailFunction)
    expect(opts.idempotency).toBe('event.data.orderId')
    expect(opts.retries).toBe(EMAIL_FUNCTION_RETRIES)
  })

  it('includes the new status in the status-email dedupe key', () => {
    // An order legitimately earns an email per status; keying on the order id
    // alone would deliver only the first one.
    expect(internals(sendOrderStatusEmailFunction).opts.idempotency).toBe(
      'event.data.orderId + "-" + event.data.newStatus'
    )
  })

  it('includes the refund id in the refund-email dedupe key', () => {
    // An order can be partially refunded more than once.
    expect(internals(sendOrderRefundEmailFunction).opts.idempotency).toBe(
      'event.data.orderId + "-" + event.data.refundId + "-" + event.data.refundStatus'
    )
  })

  it('formats the confirmation in the currency the order was purchased in', async () => {
    const { step } = createStep()

    const result = await internals(sendOrderConfirmationEmailFunction).fn({
      event: CONFIRMATION_EVENT,
      step,
    })

    expect(mockDeliverConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        orderId: 'ord1234',
        totalAmount: expect.stringContaining('200'),
        items: [expect.objectContaining({ name: 'Widget', quantity: 2 })],
      })
    )
    expect(result).toMatchObject({
      referenceId: 'ord1234',
      emailType: 'order_confirmation',
      delivered: true,
    })
  })

  it('scores delivery and provider fallback', async () => {
    const { step, scores } = createStep()
    mockDeliverConfirmation.mockResolvedValue({
      emailSuppressed: false,
      emailDelivered: true,
      usedFallbackProvider: true,
    })

    await internals(sendOrderConfirmationEmailFunction).fn({
      event: CONFIRMATION_EVENT,
      step,
    })

    expect(scores).toEqual([
      { name: 'email-delivered-first-attempt', value: true },
      { name: 'email-provider-fallback-used', value: true },
    ])
  })

  it('does not score a suppressed email as a delivery', async () => {
    const { step, scores } = createStep()
    mockDeliverConfirmation.mockResolvedValue({
      emailSuppressed: true,
      emailDelivered: false,
      usedFallbackProvider: false,
    })

    await internals(sendOrderConfirmationEmailFunction).fn({
      event: CONFIRMATION_EVENT,
      step,
    })

    // Opting out is a correct outcome, not a failed delivery; scoring it
    // would deflate the delivery rate with people who asked not to be mailed.
    expect(scores).toEqual([])
  })

  it('records a failed email once retries are exhausted', async () => {
    mockSaveFailedEmail.mockResolvedValue(undefined)

    await internals(sendOrderConfirmationEmailFunction).onFailureFn?.({
      event: { data: { event: CONFIRMATION_EVENT } },
      error: new Error('provider down'),
    })

    expect(mockSaveFailedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'customer@example.com',
        emailType: 'order_confirmation',
        referenceId: 'ord1234',
        isRetriable: false,
        attemptCount: EMAIL_FUNCTION_RETRIES + 1,
      })
    )
  })

  it('never lets a bookkeeping write mask the delivery failure', async () => {
    mockSaveFailedEmail.mockRejectedValue(new Error('db down'))

    await expect(
      internals(sendOrderConfirmationEmailFunction).onFailureFn?.({
        event: { data: { event: CONFIRMATION_EVENT } },
        error: new Error('provider down'),
      })
    ).resolves.toBeUndefined()

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'inngest_email_failure_record_write' })
    )
  })
})
