import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDbCheckoutRequestsCreate,
  mockDbCheckoutRequestsUpdateStatus,
  mockDbCheckoutRequestsFindById,
  mockDbCheckoutRequestsFindRecentWithOrders,
  mockDbOrdersFindFirstByCheckoutRequestId,
  mockLogBusinessEvent,
  mockLogError,
  mockLogPerformance,
  mockSend,
  mockCreateOrderForUser,
  mockEnsurePaymentProviderConfigured,
} = vi.hoisted(() => ({
  mockDbCheckoutRequestsCreate: vi.fn(),
  mockDbCheckoutRequestsUpdateStatus: vi.fn().mockResolvedValue(undefined),
  mockDbCheckoutRequestsFindById: vi.fn().mockResolvedValue(null),
  mockDbCheckoutRequestsFindRecentWithOrders: vi.fn().mockResolvedValue([]),
  mockDbOrdersFindFirstByCheckoutRequestId: vi.fn().mockResolvedValue(null),
  mockLogBusinessEvent: vi.fn(),
  mockLogError: vi.fn(),
  mockLogPerformance: vi.fn(),
  mockSend: vi.fn(),
  mockCreateOrderForUser: vi.fn(),
  mockEnsurePaymentProviderConfigured: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    checkoutRequests: {
      create: mockDbCheckoutRequestsCreate,
      updateStatus: mockDbCheckoutRequestsUpdateStatus,
      findById: mockDbCheckoutRequestsFindById,
      findRecentWithOrders: mockDbCheckoutRequestsFindRecentWithOrders,
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
}))

vi.mock('@/lib/queue', () => ({
  send: mockSend,
}))

vi.mock('@/features/orders/services/order-service', () => ({
  createOrderForUser: mockCreateOrderForUser,
  isOrderRequestError: (error: unknown) =>
    error instanceof Error && 'status' in error,
}))

vi.mock('@/lib/payments', () => ({
  ensurePaymentProviderConfigured: mockEnsurePaymentProviderConfigured,
  PaymentConfigurationError: class PaymentConfigurationError extends Error {
    status: number
    constructor(message: string, status = 503) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}))

import {
  enqueueCheckoutForUser,
  getCheckoutRequestStatusForUser,
  processCheckoutRequestById,
  getRecentCheckoutRequests,
  recoverCheckoutRequestAfterRetryExhaustion,
  isCheckoutRequestError,
  type CheckoutSessionUser,
} from '@/features/cart/services/checkout-service'

const testUser: CheckoutSessionUser = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
}

describe('checkout-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isCheckoutRequestError', () => {
    it('returns false for plain errors', () => {
      expect(isCheckoutRequestError(new Error('test'))).toBe(false)
    })

    it('returns false for non-error values', () => {
      expect(isCheckoutRequestError('string')).toBe(false)
      expect(isCheckoutRequestError(null)).toBe(false)
    })
  })

  describe('enqueueCheckoutForUser', () => {
    it('creates checkout request and publishes to queue', async () => {
      mockDbCheckoutRequestsCreate.mockResolvedValue({
        id: 'cr1abc',
        status: 'PENDING',
      })
      mockSend.mockResolvedValue(undefined)

      const result = await enqueueCheckoutForUser({
        body: {
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
        },
        user: testUser,
      })

      expect(result.checkoutRequestId).toBe('cr1abc')
      expect(result.status).toBe('PENDING')
      expect(mockSend).toHaveBeenCalled()
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'checkout_request_queued',
          success: true,
        })
      )
    })

    it('falls back to inline processing when queue publish fails', async () => {
      mockDbCheckoutRequestsCreate.mockResolvedValue({
        id: 'cr2abcd',
        status: 'PENDING',
      })
      mockSend.mockRejectedValue(new Error('Queue down'))

      const result = await enqueueCheckoutForUser({
        body: {
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
        },
        user: testUser,
      })

      expect(result.checkoutRequestId).toBe('cr2abcd')
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'checkout_queue_publish_failed_using_inline_fallback',
        })
      )
    })

    it('throws on invalid checkout input', async () => {
      await expect(
        enqueueCheckoutForUser({
          body: { items: [] },
          user: testUser,
        })
      ).rejects.toThrow()
    })

    it('uses user name/email as defaults when body fields empty', async () => {
      mockDbCheckoutRequestsCreate.mockResolvedValue({
        id: 'cr3abcd',
        status: 'PENDING',
      })
      mockSend.mockResolvedValue(undefined)

      await enqueueCheckoutForUser({
        body: {
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
        },
        user: testUser,
      })

      expect(mockDbCheckoutRequestsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'Test User',
          customerEmail: 'test@example.com',
        })
      )
    })
  })

  describe('getCheckoutRequestStatusForUser', () => {
    it('throws when checkout request not found for user', async () => {
      mockDbCheckoutRequestsFindById.mockResolvedValue({
        id: 'cr1ab23',
        userId: 'other_user',
        status: 'PENDING',
      })

      await expect(
        getCheckoutRequestStatusForUser({
          checkoutRequestId: 'cr1ab23',
          userId: 'user1',
        })
      ).rejects.toThrow('Checkout request not found')
    })
  })

  describe('processCheckoutRequestById', () => {
    it('returns early when checkout request is missing', async () => {
      mockDbCheckoutRequestsFindById.mockResolvedValue(null)

      await processCheckoutRequestById('cr1ab23')

      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'checkout_request_missing',
          success: false,
        })
      )
    })

    it('returns early when already completed or failed', async () => {
      mockDbCheckoutRequestsFindById.mockResolvedValue({
        id: 'cr1ab23',
        userId: 'user1',
        status: 'COMPLETED',
      })
      mockDbOrdersFindFirstByCheckoutRequestId.mockResolvedValue(null)

      await processCheckoutRequestById('cr1ab23')

      expect(mockCreateOrderForUser).not.toHaveBeenCalled()
    })

    it('marks pending requests as completed when an order already exists', async () => {
      mockDbCheckoutRequestsFindById.mockResolvedValue({
        id: 'cr1ab23',
        userId: 'user1',
        status: 'PENDING',
      })
      mockDbOrdersFindFirstByCheckoutRequestId.mockResolvedValue({ id: 'ord1' })

      await processCheckoutRequestById('cr1ab23')

      expect(mockDbCheckoutRequestsUpdateStatus).toHaveBeenCalledWith(
        'cr1ab23',
        'COMPLETED',
        null
      )
      expect(mockCreateOrderForUser).not.toHaveBeenCalled()
    })

    it('records checkout queue lag before processing', async () => {
      mockDbCheckoutRequestsFindById.mockResolvedValue({
        id: 'cr2xy89',
        userId: 'user1',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerAddress: '123 Street',
        addressLine1: '123 Street',
        addressLine2: '',
        addressLine3: '',
        pinCode: '110001',
        city: 'New Delhi',
        state: 'Delhi',
        items: [],
        status: 'PENDING',
        createdAt: new Date(Date.now() - 2_000),
      })
      mockDbOrdersFindFirstByCheckoutRequestId.mockResolvedValue(null)
      mockDbCheckoutRequestsUpdateStatus.mockResolvedValue(undefined)
      mockCreateOrderForUser.mockResolvedValue({ order: { id: 'ord1' } })

      await processCheckoutRequestById('cr2xy89')

      expect(mockLogPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'queue.checkout.lag',
        })
      )
    })

    it('throws on invalid checkout request id', async () => {
      await expect(processCheckoutRequestById('')).rejects.toThrow()
    })
  })

  describe('getRecentCheckoutRequests', () => {
    it('returns filtered checkout requests', async () => {
      mockDbCheckoutRequestsFindRecentWithOrders.mockResolvedValue([
        {
          id: 'cr1',
          userId: 'user1',
          customerName: 'Test',
          customerEmail: 'test@example.com',
          customerAddress: '123 St',
          addressLine1: '123 Main Street',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [{ productId: 'p1' }],
          status: 'PENDING',
          errorMessage: null,
          orderId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ])

      const result = await getRecentCheckoutRequests()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cr1')
      expect(result[0].itemCount).toBe(1)
    })

    it('filters by status', async () => {
      mockDbCheckoutRequestsFindRecentWithOrders.mockResolvedValue([
        {
          id: 'cr1',
          userId: 'user1',
          customerName: 'Test',
          customerEmail: 'test@example.com',
          customerAddress: '123 St',
          addressLine1: '123 Main Street',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [],
          status: 'PENDING',
          errorMessage: null,
          orderId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'cr2',
          userId: 'user1',
          customerName: 'Test2',
          customerEmail: 'test2@example.com',
          customerAddress: '456 St',
          addressLine1: '123 Main Street',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [],
          status: 'COMPLETED',
          errorMessage: null,
          orderId: 'ord1',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ])

      const result = await getRecentCheckoutRequests({
        status: 'PENDING',
      })

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('PENDING')
    })

    it('filters by search term', async () => {
      mockDbCheckoutRequestsFindRecentWithOrders.mockResolvedValue([
        {
          id: 'cr1',
          userId: 'user1',
          customerName: 'Alice',
          customerEmail: 'alice@example.com',
          customerAddress: '123 St',
          addressLine1: '123 Main Street',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [],
          status: 'PENDING',
          errorMessage: null,
          orderId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ])

      const result = await getRecentCheckoutRequests({ search: 'alice' })

      expect(result).toHaveLength(1)
    })
  })

  describe('recoverCheckoutRequestAfterRetryExhaustion', () => {
    it('marks as COMPLETED when order already exists', async () => {
      mockDbOrdersFindFirstByCheckoutRequestId.mockResolvedValue({ id: 'ord1' })
      mockDbCheckoutRequestsUpdateStatus.mockResolvedValue(undefined)

      await recoverCheckoutRequestAfterRetryExhaustion({
        checkoutRequestId: 'cr1',
        deliveryCount: 3,
        error: new Error('test'),
      })

      expect(mockDbCheckoutRequestsUpdateStatus).toHaveBeenCalledWith(
        'cr1',
        'COMPLETED',
        null
      )
    })

    it('marks as FAILED when no order exists', async () => {
      mockDbOrdersFindFirstByCheckoutRequestId.mockResolvedValue(null)
      mockDbCheckoutRequestsUpdateStatus.mockResolvedValue(undefined)

      await recoverCheckoutRequestAfterRetryExhaustion({
        checkoutRequestId: 'cr1',
        deliveryCount: 5,
        error: new Error('Failed'),
      })

      expect(mockDbCheckoutRequestsUpdateStatus).toHaveBeenCalledWith(
        'cr1',
        'FAILED',
        expect.any(String)
      )
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'checkout_request_retry_exhausted',
          success: false,
        })
      )
    })

    it('includes fallback reason when retry exhaustion receives malformed error payload', async () => {
      mockDbOrdersFindFirstByCheckoutRequestId.mockResolvedValue(null)
      mockDbCheckoutRequestsUpdateStatus.mockResolvedValue(undefined)

      await recoverCheckoutRequestAfterRetryExhaustion({
        checkoutRequestId: 'cr1',
        deliveryCount: 2,
        error: { message: null },
      })

      expect(mockDbCheckoutRequestsUpdateStatus).toHaveBeenCalledWith(
        'cr1',
        'FAILED',
        'Automatic recovery stopped after 2 attempts: Unknown consumer error'
      )
    })
  })
})
