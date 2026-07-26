import { describe, it, expect, vi, beforeEach } from 'vitest'

const { PaymentConfigError } = vi.hoisted(() => ({
  PaymentConfigError: class PaymentConfigError extends Error {
    status: number
    constructor(message: string, status = 503) {
      super(message)
      this.status = status
    }
  },
}))

const m = vi.hoisted(() => ({
  create: vi.fn(),
  updateStatus: vi.fn(),
  claimForProcessing: vi.fn(),
  findById: vi.fn(),
  findRecentWithOrders: vi.fn(),
  findFirstByCheckoutRequestId: vi.fn(),
  logBusinessEvent: vi.fn(),
  logError: vi.fn(),
  logPerformance: vi.fn(),
  send: vi.fn(),
  createOrderForUser: vi.fn(),
  ensurePaymentProviderConfigured: vi.fn(),
  waitUntil: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    checkoutRequests: {
      create: m.create,
      updateStatus: m.updateStatus,
      claimForProcessing: m.claimForProcessing,
      findById: m.findById,
      findRecentWithOrders: m.findRecentWithOrders,
    },
    orders: { findFirstByCheckoutRequestId: m.findFirstByCheckoutRequestId },
  },
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: m.logBusinessEvent,
  logError: m.logError,
  logPerformance: m.logPerformance,
}))

vi.mock('@/lib/queue', () => ({ send: m.send }))

class OrderRequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

vi.mock('@/features/orders/services/order-service', () => ({
  createOrderForUser: m.createOrderForUser,
  isOrderRequestError: (error: unknown) =>
    error instanceof Error && 'status' in error,
}))

vi.mock('@/lib/payments', () => ({
  ensurePaymentProviderConfigured: m.ensurePaymentProviderConfigured,
  PaymentConfigurationError: PaymentConfigError,
}))

vi.mock('@vercel/functions', () => ({ waitUntil: m.waitUntil }))

import {
  enqueueCheckoutForUser,
  getCheckoutRequestStatusForUser,
  processCheckoutRequestById,
  type CheckoutSessionUser,
} from '@/features/cart/services/checkout-service'

const testUser: CheckoutSessionUser = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
}

const validBody = {
  customerName: 'Test',
  customerEmail: 'test@example.com',
  addressLine1: '123 Main Street',
  addressLine2: '',
  addressLine3: '',
  pinCode: '110001',
  city: 'New Delhi',
  state: 'Delhi',
  items: [{ productId: 'abc1234', variantId: 'var0001', quantity: 1 }],
}

const checkoutRow = {
  id: 'cr2xy89',
  userId: 'user1',
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  customerAddress: '123 Street',
  addressLine1: null,
  addressLine2: null,
  addressLine3: null,
  pinCode: null,
  city: null,
  state: null,
  items: [
    {
      productId: 'abc1234',
      variantId: 'var0001',
      quantity: 1,
      customizationNote: null,
    },
  ],
  status: 'PENDING' as const,
  errorMessage: null,
  paymentProvider: null,
  paymentOrderId: null,
  paymentTransactionId: null,
  paymentSignature: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  m.create.mockResolvedValue({ id: 'cr1abc', status: 'PENDING' })
  m.send.mockResolvedValue(undefined)
  m.updateStatus.mockResolvedValue(undefined)
  m.claimForProcessing.mockResolvedValue(true)
  m.findFirstByCheckoutRequestId.mockResolvedValue(null)
  m.createOrderForUser.mockResolvedValue({ order: { id: 'ord1' } })
})

describe('enqueueCheckoutForUser (extended)', () => {
  it('maps payment configuration errors to checkout errors', async () => {
    m.ensurePaymentProviderConfigured.mockImplementation(() => {
      throw new PaymentConfigError('Provider unavailable', 503)
    })

    await expect(
      enqueueCheckoutForUser({
        body: {
          ...validBody,
          payment: {
            provider: 'RAZORPAY',
            orderId: 'order_123',
            paymentId: 'pay_123',
            signature: 'sig_123',
          },
        },
        user: testUser,
      })
    ).rejects.toThrow('Provider unavailable')
  })

  it('rethrows unexpected payment validation errors', async () => {
    m.ensurePaymentProviderConfigured.mockImplementation(() => {
      throw new Error('boom')
    })

    await expect(
      enqueueCheckoutForUser({
        body: {
          ...validBody,
          payment: {
            provider: 'RAZORPAY',
            orderId: 'order_123',
            paymentId: 'pay_123',
            signature: 'sig_123',
          },
        },
        user: testUser,
      })
    ).rejects.toThrow('boom')
  })

  it('stores empty optional address lines as null', async () => {
    await enqueueCheckoutForUser({ body: validBody, user: testUser })

    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({
        addressLine2: null,
        addressLine3: null,
        paymentProvider: null,
        paymentOrderId: null,
        paymentTransactionId: null,
        paymentSignature: null,
      })
    )
  })

  it('coerces a non-object body into validation errors', async () => {
    await expect(
      enqueueCheckoutForUser({ body: 'not-an-object', user: testUser })
    ).rejects.toThrow()
  })
})

describe('getCheckoutRequestStatusForUser (extended)', () => {
  it('completes the request when an order already exists', async () => {
    m.findById.mockResolvedValue({ ...checkoutRow, userId: 'user1' })
    m.findFirstByCheckoutRequestId.mockResolvedValue({ id: 'ord1' })

    const result = await getCheckoutRequestStatusForUser({
      checkoutRequestId: 'cr2xy89',
      userId: 'user1',
    })

    expect(m.updateStatus).toHaveBeenCalledWith('cr2xy89', 'COMPLETED', null)
    expect(result).toEqual({
      checkoutRequestId: 'cr2xy89',
      status: 'COMPLETED',
      orderId: 'ord1',
      error: null,
    })
  })

  it('skips the status update when already completed', async () => {
    m.findById.mockResolvedValue({ ...checkoutRow, status: 'COMPLETED' })
    m.findFirstByCheckoutRequestId.mockResolvedValue({ id: 'ord1' })

    await getCheckoutRequestStatusForUser({
      checkoutRequestId: 'cr2xy89',
      userId: 'user1',
    })

    expect(m.updateStatus).not.toHaveBeenCalled()
  })

  it('surfaces the stored error message when no order exists', async () => {
    m.findById.mockResolvedValue({
      ...checkoutRow,
      status: 'FAILED',
      errorMessage: 'Out of stock',
    })

    const result = await getCheckoutRequestStatusForUser({
      checkoutRequestId: 'cr2xy89',
      userId: 'user1',
    })

    expect(result).toEqual({
      checkoutRequestId: 'cr2xy89',
      status: 'FAILED',
      orderId: null,
      error: 'Out of stock',
    })
  })
})

describe('processCheckoutRequestById (extended)', () => {
  it('skips the status update when the existing order is already completed', async () => {
    m.findById.mockResolvedValue({ ...checkoutRow, status: 'COMPLETED' })
    m.findFirstByCheckoutRequestId.mockResolvedValue({ id: 'ord1' })

    await processCheckoutRequestById('cr2xy89')

    expect(m.updateStatus).not.toHaveBeenCalled()
  })

  it('normalizes missing address fields and customization notes', async () => {
    m.findById.mockResolvedValue({
      ...checkoutRow,
      items: [
        {
          productId: 'abc1234',
          variantId: 'var0001',
          quantity: 1,
          customizationNote: 'Gift wrap',
        },
      ],
    })

    await processCheckoutRequestById('cr2xy89')

    expect(m.createOrderForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          addressLine1: '',
          pinCode: '',
          city: '',
          state: '',
          payment: undefined,
          items: [expect.objectContaining({ customizationNote: 'Gift wrap' })],
        }),
      })
    )
    expect(m.logBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'checkout_request_completed' })
    )
  })

  it('forwards a complete payment payload', async () => {
    m.findById.mockResolvedValue({
      ...checkoutRow,
      paymentProvider: 'RAZORPAY',
      paymentOrderId: 'order_1',
      paymentTransactionId: 'pay_1',
      paymentSignature: 'sig_1',
    })

    await processCheckoutRequestById('cr2xy89')

    expect(m.createOrderForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          payment: {
            provider: 'RAZORPAY',
            orderId: 'order_1',
            paymentId: 'pay_1',
            signature: 'sig_1',
          },
        }),
      })
    )
  })

  it('marks the request FAILED for client-side order errors', async () => {
    m.findById.mockResolvedValue(checkoutRow)
    m.createOrderForUser.mockRejectedValue(
      new OrderRequestError('Out of stock', 400)
    )

    await processCheckoutRequestById('cr2xy89')

    expect(m.updateStatus).toHaveBeenCalledWith(
      'cr2xy89',
      'FAILED',
      'Out of stock'
    )
    expect(m.logBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'checkout_request_failed' })
    )
  })

  it('resets the request to PENDING and rethrows server errors', async () => {
    m.findById.mockResolvedValue(checkoutRow)
    m.createOrderForUser.mockRejectedValue(
      new OrderRequestError('Database down', 500)
    )

    await expect(processCheckoutRequestById('cr2xy89')).rejects.toThrow(
      'Database down'
    )
    expect(m.updateStatus).toHaveBeenCalledWith(
      'cr2xy89',
      'PENDING',
      'Database down'
    )
  })

  it('uses a fallback message for non-error rejections', async () => {
    m.findById.mockResolvedValue(checkoutRow)
    m.createOrderForUser.mockRejectedValue('kaboom')

    await expect(processCheckoutRequestById('cr2xy89')).rejects.toBe('kaboom')
    expect(m.updateStatus).toHaveBeenCalledWith(
      'cr2xy89',
      'PENDING',
      'Temporary checkout processing failure'
    )
  })
})
