import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockSelect,
  mockUpdate,
  mockVerifyRazorpayWebhookSignature,
  mockProcessCheckoutRequestById,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockVerifyRazorpayWebhookSignature: vi.fn(),
  mockProcessCheckoutRequestById: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: {
    select: mockSelect,
    update: mockUpdate,
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
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => args),
  eq: vi.fn((...args) => args),
}))

vi.mock('@/lib/payments', () => ({
  verifyRazorpayWebhookSignature: mockVerifyRazorpayWebhookSignature,
  PaymentVerificationError: class PaymentVerificationError extends Error {
    status: number
    constructor(message: string, status = 401) {
      super(message)
      this.status = status
    }
  },
  PaymentConfigurationError: class PaymentConfigurationError extends Error {
    status: number
    constructor(message: string, status = 503) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  processCheckoutRequestById: mockProcessCheckoutRequestById,
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

import { POST } from '@/app/api/payments/webhook/route'

const makeSelectChain = (result: unknown) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(result),
})

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })
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
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]) as never)
      .mockReturnValueOnce(
        makeSelectChain([{ id: 'chk_123', status: 'PENDING' }]) as never
      )

    const response = await POST(
      new NextRequest('http://localhost/api/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_123',
                order_id: 'order_123',
                amount: 19900,
              },
            },
          },
        }),
        headers: { 'x-razorpay-signature': 'valid_signature' },
      })
    )

    expect(response.status).toBe(200)
    expect(mockVerifyRazorpayWebhookSignature).toHaveBeenCalled()
    expect(mockProcessCheckoutRequestById).toHaveBeenCalledWith('chk_123')
  })
})
