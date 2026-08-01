import { describe, it, expect } from 'vitest'
import {
  PaymentProviderSchema,
  PaymentReferenceSchema,
} from '@/lib/validations/payment'
import { PAYMENT_PROVIDERS } from '@/lib/payments/providers'

describe('PaymentProviderSchema', () => {
  it('accepts every registered gateway', () => {
    for (const provider of PAYMENT_PROVIDERS) {
      expect(PaymentProviderSchema.parse(provider)).toBe(provider)
    }
  })

  it('rejects unregistered providers', () => {
    expect(PaymentProviderSchema.safeParse('STRIPE').success).toBe(false)
  })
})

describe('PaymentReferenceSchema', () => {
  const razorpayReference = {
    provider: 'RAZORPAY',
    orderId: 'order_123',
    paymentId: 'pay_123',
    signature: 'sig_123',
  }

  it('accepts a fully signed Razorpay reference', () => {
    expect(PaymentReferenceSchema.parse(razorpayReference)).toEqual(
      razorpayReference
    )
  })

  it.each(['orderId', 'paymentId', 'signature'] as const)(
    'rejects a Razorpay reference missing %s',
    (field) => {
      const { [field]: _omitted, ...partial } = razorpayReference
      const result = PaymentReferenceSchema.safeParse(partial)

      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual([field])
    }
  )

  it('accepts Cash on Delivery without gateway references', () => {
    expect(PaymentReferenceSchema.parse({ provider: 'COD' })).toEqual({
      provider: 'COD',
    })
  })
})
