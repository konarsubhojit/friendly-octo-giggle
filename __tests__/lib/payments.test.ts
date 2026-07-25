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
  ensurePaymentProviderConfigured,
  verifyCheckoutPayment,
  verifyRazorpayWebhookSignature,
} = await import('@/lib/payments')

const signature = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('hex')

const basePayment = {
  provider: 'RAZORPAY' as const,
  orderId: 'order_123',
  paymentId: 'pay_123',
  signature: signature('key_secret', 'order_123|pay_123'),
}

const razorpayResponse = (
  overrides: Record<string, unknown> = {},
  ok = true
) => ({
  ok,
  json: async () => ({
    id: 'pay_123',
    order_id: 'order_123',
    amount: 25000,
    status: 'captured',
    captured_at: 1_700_000_000,
    ...overrides,
  }),
})

describe('payments', () => {
  beforeEach(() => {
    envMock.RAZORPAY_KEY_ID = 'key_id'
    envMock.RAZORPAY_KEY_SECRET = 'key_secret'
    envMock.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('error classes', () => {
    it('defaults PaymentConfigurationError to status 503', () => {
      const error = new PaymentConfigurationError('nope')
      expect(error.name).toBe('PaymentConfigurationError')
      expect(error.status).toBe(503)
    })

    it('accepts an explicit PaymentConfigurationError status', () => {
      expect(new PaymentConfigurationError('nope', 400).status).toBe(400)
    })

    it('defaults PaymentVerificationError to status 400', () => {
      const error = new PaymentVerificationError('bad')
      expect(error.name).toBe('PaymentVerificationError')
      expect(error.status).toBe(400)
    })

    it('accepts an explicit PaymentVerificationError status', () => {
      expect(new PaymentVerificationError('bad', 502).status).toBe(502)
    })
  })

  describe('ensurePaymentProviderConfigured', () => {
    it('passes for a configured Razorpay provider', () => {
      expect(() => ensurePaymentProviderConfigured('RAZORPAY')).not.toThrow()
    })

    it('throws when Razorpay keys are missing', () => {
      envMock.RAZORPAY_KEY_SECRET = undefined
      expect(() => ensurePaymentProviderConfigured('RAZORPAY')).toThrow(
        PaymentConfigurationError
      )
    })

    it('throws for unsupported providers', () => {
      expect(() =>
        ensurePaymentProviderConfigured(
          'PAYPAL' as unknown as 'RAZORPAY'
        )
      ).toThrow('Unsupported payment provider')
    })
  })

  describe('verifyCheckoutPayment', () => {
    it('rejects unsupported providers', async () => {
      await expect(
        verifyCheckoutPayment({
          payment: {
            ...basePayment,
            provider: 'PAYPAL' as unknown as 'RAZORPAY',
          },
          expectedAmount: 250,
        })
      ).rejects.toThrow('Unsupported payment provider')
    })

    it('rejects when the provider is not configured', async () => {
      envMock.RAZORPAY_KEY_ID = undefined
      await expect(
        verifyCheckoutPayment({ payment: basePayment, expectedAmount: 250 })
      ).rejects.toThrow(PaymentConfigurationError)
    })

    it('rejects a signature of mismatched length', async () => {
      await expect(
        verifyCheckoutPayment({
          payment: { ...basePayment, signature: 'short' },
          expectedAmount: 250,
        })
      ).rejects.toThrow('Invalid payment signature')
    })

    it('rejects a same-length but incorrect signature', async () => {
      const wrong = signature('other_secret', 'order_123|pay_123')
      await expect(
        verifyCheckoutPayment({
          payment: { ...basePayment, signature: wrong },
          expectedAmount: 250,
        })
      ).rejects.toThrow('Invalid payment signature')
    })

    it('rejects when the Razorpay lookup fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(razorpayResponse({}, false))
      )
      await expect(
        verifyCheckoutPayment({ payment: basePayment, expectedAmount: 250 })
      ).rejects.toThrow('Unable to verify payment transaction')
    })

    it('rejects payments that are not captured', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(razorpayResponse({ status: 'authorized' }))
      )
      await expect(
        verifyCheckoutPayment({ payment: basePayment, expectedAmount: 250 })
      ).rejects.toThrow('Payment has not been captured')
    })

    it('rejects when the payment maps to a different order', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(razorpayResponse({ order_id: 'order_999' }))
      )
      await expect(
        verifyCheckoutPayment({ payment: basePayment, expectedAmount: 250 })
      ).rejects.toThrow('Payment order mismatch')
    })

    it('rejects when the paid amount differs from the order total', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(razorpayResponse()))
      await expect(
        verifyCheckoutPayment({ payment: basePayment, expectedAmount: 300 })
      ).rejects.toThrow('Paid amount does not match order total')
    })

    it('rejects amounts outside the safe integer range', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(razorpayResponse()))
      await expect(
        verifyCheckoutPayment({
          payment: basePayment,
          expectedAmount: Number.MAX_SAFE_INTEGER,
        })
      ).rejects.toThrow('Order amount is out of supported range')
    })

    it('rejects when the capture timestamp is missing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(razorpayResponse({ captured_at: undefined }))
      )
      await expect(
        verifyCheckoutPayment({ payment: basePayment, expectedAmount: 250 })
      ).rejects.toThrow('Payment capture timestamp is missing')
    })

    it('returns normalized payment details for a captured payment', async () => {
      const fetchMock = vi.fn().mockResolvedValue(razorpayResponse())
      vi.stubGlobal('fetch', fetchMock)

      const result = await verifyCheckoutPayment({
        payment: basePayment,
        expectedAmount: 250,
      })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.razorpay.com/v1/payments/pay_123',
        expect.objectContaining({ cache: 'no-store' })
      )
      expect(result).toEqual({
        provider: 'RAZORPAY',
        paymentOrderId: 'order_123',
        paymentTransactionId: 'pay_123',
        amountPaid: 250,
        paidAt: new Date(1_700_000_000 * 1000),
      })
    })

    it('normalizes fractional amounts to minor units', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(razorpayResponse({ amount: 12345 }))
      )
      const result = await verifyCheckoutPayment({
        payment: basePayment,
        expectedAmount: 123.45,
      })
      expect(result.amountPaid).toBe(123.45)
    })
  })

  describe('verifyRazorpayWebhookSignature', () => {
    it('throws when the webhook secret is missing', () => {
      envMock.RAZORPAY_WEBHOOK_SECRET = undefined
      expect(() =>
        verifyRazorpayWebhookSignature({ payload: '{}', signature: 'sig' })
      ).toThrow(PaymentConfigurationError)
    })

    it('throws a 401 for an invalid signature', () => {
      try {
        verifyRazorpayWebhookSignature({ payload: '{}', signature: 'sig' })
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentVerificationError)
        expect((error as InstanceType<typeof PaymentVerificationError>).status).toBe(401)
      }
    })

    it('throws for a same-length but incorrect signature', () => {
      expect(() =>
        verifyRazorpayWebhookSignature({
          payload: '{}',
          signature: signature('other', '{}'),
        })
      ).toThrow('Invalid webhook signature')
    })

    it('accepts a valid signature', () => {
      expect(() =>
        verifyRazorpayWebhookSignature({
          payload: '{"event":"payment.captured"}',
          signature: signature(
            'webhook_secret',
            '{"event":"payment.captured"}'
          ),
        })
      ).not.toThrow()
    })
  })
})
