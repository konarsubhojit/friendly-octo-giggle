import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'

const envMock = vi.hoisted(() => ({
  RAZORPAY_KEY_ID: 'key_id' as string | undefined,
  RAZORPAY_KEY_SECRET: 'key_secret' as string | undefined,
  RAZORPAY_WEBHOOK_SECRET: 'webhook_secret' as string | undefined,
}))

vi.mock('@/lib/env', () => ({ env: envMock }))

const {
  PaymentConfigurationError,
  PaymentVerificationError,
  getPaymentGateway,
  listPaymentGateways,
  verifyCheckoutPayment,
  settlesPaymentOnDelivery,
  requiresPaymentSignature,
  PAYMENT_PROVIDERS,
} = await import('@/lib/payments')

const sign = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('hex')

const webhookHeaders = (payload: string, extra: Record<string, string> = {}) =>
  new Headers({
    'x-razorpay-signature': sign('webhook_secret', payload),
    ...extra,
  })

beforeEach(() => {
  envMock.RAZORPAY_KEY_ID = 'key_id'
  envMock.RAZORPAY_KEY_SECRET = 'key_secret'
  envMock.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('payment gateway registry', () => {
  it('registers a gateway for every declared provider', () => {
    expect(
      listPaymentGateways()
        .map((gateway) => gateway.provider)
        .sort()
    ).toEqual([...PAYMENT_PROVIDERS].sort())
  })

  it('throws a 400 configuration error for unregistered providers', () => {
    try {
      getPaymentGateway('STRIPE')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentConfigurationError)
      expect(
        (error as InstanceType<typeof PaymentConfigurationError>).status
      ).toBe(400)
    }
  })
})

describe('provider capabilities', () => {
  it('requires a signed reference for Razorpay but not for COD', () => {
    expect(requiresPaymentSignature('RAZORPAY')).toBe(true)
    expect(requiresPaymentSignature('COD')).toBe(false)
  })

  it('fails closed for unknown providers', () => {
    expect(requiresPaymentSignature('STRIPE')).toBe(true)
    expect(settlesPaymentOnDelivery('STRIPE')).toBe(false)
  })

  it('marks only COD as settling on delivery', () => {
    expect(settlesPaymentOnDelivery('COD')).toBe(true)
    expect(settlesPaymentOnDelivery('RAZORPAY')).toBe(false)
    expect(settlesPaymentOnDelivery(null)).toBe(false)
  })
})

describe('cash on delivery gateway', () => {
  const codGateway = getPaymentGateway('COD')

  it('needs no configuration', () => {
    expect(() => codGateway.ensureConfigured()).not.toThrow()
  })

  it('creates a local order reference from the receipt', async () => {
    const order = await codGateway.createOrder({
      amount: 250,
      currency: 'INR',
      receipt: 'chk_123',
    })

    expect(order).toEqual({
      provider: 'COD',
      orderId: 'cod_chk_123',
      amount: 250,
      currency: 'INR',
    })
  })

  it('verifies an unpaid order that settles later', async () => {
    const verified = await verifyCheckoutPayment({
      payment: { provider: 'COD' },
      expectedAmount: 250,
      reference: 'chk_123',
    })

    expect(verified).toEqual({
      provider: 'COD',
      paymentOrderId: 'cod_chk_123',
      paymentTransactionId: 'cod_chk_123',
      amountPaid: 0,
      paidAt: null,
    })
  })

  it('derives a reference when the caller supplies none', async () => {
    const verified = await verifyCheckoutPayment({
      payment: { provider: 'COD' },
      expectedAmount: 250,
    })

    expect(verified.paymentTransactionId).toMatch(/^cod_/)
    expect(verified.paidAt).toBeNull()
  })

  it('rejects webhook deliveries and refunds', async () => {
    expect(() =>
      codGateway.verifyWebhook({ payload: '{}', headers: new Headers() })
    ).toThrow(PaymentVerificationError)
    await expect(
      codGateway.refund({ paymentTransactionId: 'cod_1', amount: 10 })
    ).rejects.toThrow(PaymentVerificationError)
  })
})

describe('razorpay gateway', () => {
  const razorpay = getPaymentGateway('RAZORPAY')

  it('creates a gateway order in minor units', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'order_1', amount: 25000, currency: 'INR' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const order = await razorpay.createOrder({
      amount: 250,
      currency: 'INR',
      receipt: 'chk_123',
    })

    expect(order).toEqual({
      provider: 'RAZORPAY',
      orderId: 'order_1',
      amount: 250,
      currency: 'INR',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.razorpay.com/v1/orders',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('surfaces order creation failures as a 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(
      razorpay.createOrder({ amount: 250, currency: 'INR', receipt: 'chk_1' })
    ).rejects.toThrow('Unable to create payment order')
  })

  it('rejects a payment missing its gateway references', async () => {
    await expect(
      razorpay.verifyPayment({
        payment: { provider: 'RAZORPAY', orderId: 'order_123' },
        expectedAmount: 250,
      })
    ).rejects.toThrow('Payment details are incomplete')
  })

  it('refunds a captured payment', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'rfnd_1', amount: 25000, status: 'processed' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      razorpay.refund({ paymentTransactionId: 'pay_123', amount: 250 })
    ).resolves.toEqual({
      provider: 'RAZORPAY',
      refundId: 'rfnd_1',
      amount: 250,
      status: 'processed',
    })
  })

  it('surfaces refund failures as a 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(
      razorpay.refund({ paymentTransactionId: 'pay_123', amount: 250 })
    ).rejects.toThrow('Unable to refund payment')
  })

  describe('verifyWebhook', () => {
    const capturedPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_123', order_id: 'order_123', amount: 19900 },
        },
      },
    })

    it('normalizes a captured payment event', () => {
      const event = razorpay.verifyWebhook({
        payload: capturedPayload,
        headers: webhookHeaders(capturedPayload, {
          'x-razorpay-event-id': 'evt_1',
        }),
      })

      expect(event).toEqual({
        provider: 'RAZORPAY',
        eventId: 'evt_1',
        eventType: 'payment.captured',
        type: 'payment.captured',
        paymentId: 'pay_123',
        paymentOrderId: 'order_123',
        amountInMinorUnits: 19900,
      })
    })

    it('falls back to a deterministic event id', () => {
      const event = razorpay.verifyWebhook({
        payload: capturedPayload,
        headers: webhookHeaders(capturedPayload),
      })

      expect(event.eventId).toBe('payment.captured:pay_123')
    })

    it('flags unrelated events as unhandled', () => {
      const payload = JSON.stringify({
        event: 'refund.processed',
        payload: {
          payment: { entity: { id: 'pay_123', order_id: 'order_123' } },
        },
      })

      expect(
        razorpay.verifyWebhook({ payload, headers: webhookHeaders(payload) })
          .type
      ).toBe('unhandled')
    })

    it('rejects a delivery without a signature header', () => {
      expect(() =>
        razorpay.verifyWebhook({
          payload: capturedPayload,
          headers: new Headers(),
        })
      ).toThrow('Missing webhook signature')
    })

    it('rejects an invalid signature', () => {
      expect(() =>
        razorpay.verifyWebhook({
          payload: capturedPayload,
          headers: new Headers({
            'x-razorpay-signature': sign('other', capturedPayload),
          }),
        })
      ).toThrow('Invalid webhook signature')
    })

    it('rejects a body that is not valid JSON', () => {
      expect(() =>
        razorpay.verifyWebhook({
          payload: 'not-json',
          headers: webhookHeaders('not-json'),
        })
      ).toThrow('Invalid webhook payload')
    })

    it('rejects a payload without payment identifiers', () => {
      const payload = JSON.stringify({ event: 'payment.captured' })
      expect(() =>
        razorpay.verifyWebhook({ payload, headers: webhookHeaders(payload) })
      ).toThrow('Invalid payment webhook payload')
    })

    it('rejects a captured event without an amount', () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_123', order_id: 'order_123' } },
        },
      })

      expect(() =>
        razorpay.verifyWebhook({ payload, headers: webhookHeaders(payload) })
      ).toThrow('Invalid payment amount in webhook payload')
    })
  })
})
