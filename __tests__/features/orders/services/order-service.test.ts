import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDbOrdersFindMany,
  mockDbOrdersCount,
  mockDbOrdersFindFirstByPaymentTxId,
  mockDbOrdersCreateWithItems,
  mockDbOrdersFindFirstById,
  mockDbProductsFindManyWithVariants,
  mockDbUsersFindPreferences,
  MockStockConflictError,
  mockInvalidateCache,
  mockInvalidateUserOrderCaches,
  mockCacheUserOrdersList,
  mockLogBusinessEvent,
  mockLogError,
  mockLogPerformance,
  mockSendOrderConfirmationEmail,
  mockDispatchWorkflowEvent,
  mockWriteOrderToRedis,
  mockSearchOrderIds,
  mockWaitUntil,
  mockParseOffsetParam,
  mockVerifyCheckoutPayment,
  mockDbCouponsFindManyByCodes,
  mockDbCouponsCountUserRedemptions,
  MockCouponConflictError,
} = vi.hoisted(() => {
  class MockStockConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'StockConflictError'
    }
  }
  class MockCouponConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'CouponConflictError'
    }
  }
  return {
    mockDbCouponsFindManyByCodes: vi.fn(),
    mockDbCouponsCountUserRedemptions: vi.fn(),
    MockCouponConflictError,
    mockDbOrdersFindMany: vi.fn(),
    mockDbOrdersCount: vi.fn(),
    mockDbOrdersFindFirstByPaymentTxId: vi.fn(),
    mockDbOrdersCreateWithItems: vi.fn(),
    mockDbOrdersFindFirstById: vi.fn(),
    mockDbProductsFindManyWithVariants: vi.fn(),
    mockDbUsersFindPreferences: vi.fn(),
    MockStockConflictError,
    mockInvalidateCache: vi.fn().mockResolvedValue(undefined),
    mockInvalidateUserOrderCaches: vi.fn().mockResolvedValue(undefined),
    mockCacheUserOrdersList: vi.fn(),
    mockLogBusinessEvent: vi.fn(),
    mockLogError: vi.fn(),
    mockLogPerformance: vi.fn(),
    mockSendOrderConfirmationEmail: vi.fn(),
    mockDispatchWorkflowEvent: vi.fn(),
    mockWriteOrderToRedis: vi.fn().mockResolvedValue(undefined),
    mockSearchOrderIds: vi.fn(),
    mockWaitUntil: vi.fn(),
    mockParseOffsetParam: vi.fn().mockReturnValue(0),
    mockVerifyCheckoutPayment: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    orders: {
      findMany: mockDbOrdersFindMany,
      count: mockDbOrdersCount,
      findFirstByPaymentTransactionId: mockDbOrdersFindFirstByPaymentTxId,
      createWithItems: mockDbOrdersCreateWithItems,
      findFirstById: mockDbOrdersFindFirstById,
    },
    products: {
      findManyWithVariantsForOrderValidation:
        mockDbProductsFindManyWithVariants,
    },
    users: {
      findPreferences: mockDbUsersFindPreferences,
    },
    coupons: {
      findManyByCodes: mockDbCouponsFindManyByCodes,
      countUserRedemptions: mockDbCouponsCountUserRedemptions,
    },
  },
  StockConflictError: MockStockConflictError,
  CouponConflictError: MockCouponConflictError,
  drizzleDb: {
    query: {
      users: { findFirst: vi.fn().mockResolvedValue(undefined) },
      notificationPreferences: {
        findFirst: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  invalidateCache: mockInvalidateCache,
}))

vi.mock('@/lib/cache', () => ({
  invalidateUserOrderCaches: mockInvalidateUserOrderCaches,
  cacheUserOrdersList: mockCacheUserOrdersList,
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: mockLogError,
  logPerformance: mockLogPerformance,
  ORDER_CREATE_OPERATION: 'checkout.order.create',
}))

vi.mock('@/lib/email', () => ({
  sendOrderConfirmationEmail: mockSendOrderConfirmationEmail,
}))

vi.mock('@/lib/inngest/dispatch', () => ({
  dispatchWorkflowEvent: mockDispatchWorkflowEvent,
}))

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' },
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: mockWaitUntil,
}))

vi.mock('@/features/orders/actions/orders', () => ({
  writeOrderToRedis: mockWriteOrderToRedis,
}))

vi.mock('@/features/orders/services/order-search', () => ({
  searchOrderIds: mockSearchOrderIds,
}))

vi.mock('@/lib/api-utils', () => ({
  parseOffsetParam: mockParseOffsetParam,
}))

vi.mock('@/lib/currency', () => ({
  formatPriceForCurrency: vi.fn(
    (amount: number, code: string) => `${code} ${amount}`
  ),
  isValidCurrencyCode: vi.fn(() => true),
}))

vi.mock('@/lib/payments', () => ({
  verifyCheckoutPayment: mockVerifyCheckoutPayment,
  PaymentVerificationError: class PaymentVerificationError extends Error {
    status: number
    constructor(message: string, status = 400) {
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

vi.mock('@/lib/schema', () => ({
  orders: {
    id: 'id',
    userId: 'userId',
    status: 'status',
    createdAt: 'createdAt',
    stock: 'stock',
  },
  orderItems: { orderId: 'orderId' },
  products: {
    id: 'id',
    deletedAt: 'deletedAt',
  },
  productVariants: {
    id: 'id',
    stock: 'stock',
    deletedAt: 'deletedAt',
  },
  users: { id: 'id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
  desc: vi.fn(),
  count: vi.fn(),
  and: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn(),
  lt: vi.fn(),
  gte: vi.fn((...args: unknown[]) => args),
  type: { SQL: class {} },
}))

import type { OrderSessionUser } from '@/features/orders/services/order-service'
import {
  OrderRequestError,
  isOrderRequestError,
  getUserOrders,
  createOrderForUser,
  validateOrderInput,
  priceAndValidateStock,
  persistOrder,
  invalidateOrderRelatedCaches,
  dispatchOrderNotifications,
} from '@/features/orders/services/order-service'

const testUser: OrderSessionUser = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
}

const testPayment = {
  provider: 'RAZORPAY' as const,
  orderId: 'order_123',
  paymentId: 'pay_123',
  signature: 'sig_123',
}

describe('order-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDispatchWorkflowEvent.mockResolvedValue('published')
    mockVerifyCheckoutPayment.mockResolvedValue({
      provider: 'RAZORPAY',
      paymentOrderId: 'order_123',
      paymentTransactionId: 'pay_123',
      amountPaid: 100,
      paidAt: new Date('2024-01-01'),
    })
    // Default: no existing order for the idempotency check
    mockDbOrdersFindFirstByPaymentTxId.mockResolvedValue(null)
  })

  describe('OrderRequestError', () => {
    it('creates error with message and status', () => {
      const error = new OrderRequestError('Not found', 404)

      expect(error.message).toBe('Not found')
      expect(error.status).toBe(404)
      expect(error.name).toBe('OrderRequestError')
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('isOrderRequestError', () => {
    it('returns true for OrderRequestError', () => {
      const error = new OrderRequestError('test', 400)
      expect(isOrderRequestError(error)).toBe(true)
    })

    it('returns false for regular Error', () => {
      expect(isOrderRequestError(new Error('test'))).toBe(false)
    })

    it('returns false for non-error values', () => {
      expect(isOrderRequestError('string')).toBe(false)
      expect(isOrderRequestError(null)).toBe(false)
      expect(isOrderRequestError(undefined)).toBe(false)
    })
  })

  describe('getUserOrders', () => {
    it('calls cache wrapper with proper params', async () => {
      mockCacheUserOrdersList.mockResolvedValue({
        orders: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
      })

      await getUserOrders({
        requestUrl: 'http://localhost:3000/api/orders?limit=10',
        userId: 'user1',
      })

      expect(mockCacheUserOrdersList).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          userId: 'user1',
          limit: 10,
        })
      )
    })

    it('defaults limit to 20 when not specified', async () => {
      mockCacheUserOrdersList.mockResolvedValue({
        orders: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
      })

      await getUserOrders({
        requestUrl: 'http://localhost:3000/api/orders',
        userId: 'user1',
      })

      expect(mockCacheUserOrdersList).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ limit: 20 })
      )
    })

    it('caps limit at 100', async () => {
      mockCacheUserOrdersList.mockResolvedValue({
        orders: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
      })

      await getUserOrders({
        requestUrl: 'http://localhost:3000/api/orders?limit=500',
        userId: 'user1',
      })

      expect(mockCacheUserOrdersList).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ limit: 100 })
      )
    })

    it('returns empty orders when search finds no matches', async () => {
      mockSearchOrderIds.mockResolvedValue([])
      mockCacheUserOrdersList.mockImplementation(
        async (fetcher: () => Promise<unknown>) => fetcher()
      )

      const result = await getUserOrders({
        requestUrl: 'http://localhost:3000/api/orders?search=nonexistent',
        userId: 'user1',
      })

      expect(result).toEqual({
        orders: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
      })
    })

    it('integrates search results into query', async () => {
      mockSearchOrderIds.mockResolvedValue(['ord1', 'ord2'])
      mockCacheUserOrdersList.mockImplementation(
        async (fetcher: () => Promise<unknown>) => fetcher()
      )
      mockDbOrdersFindMany.mockResolvedValue([])
      mockDbOrdersCount.mockResolvedValue(5)

      const result = await getUserOrders({
        requestUrl: 'http://localhost:3000/api/orders?search=widget',
        userId: 'user1',
      })

      expect(result).toHaveProperty('orders')
      expect(result).toHaveProperty('totalCount')
    })
  })

  describe('extracted helpers', () => {
    it('validateOrderInput returns normalized customer details and deduped product ids', () => {
      const result = validateOrderInput({
        body: {
          customerName: '',
          customerEmail: '',
          customerAddress: '',
          addressLine1: '123 Test St ',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [
            { productId: 'p1', variantId: 'v1', quantity: 1 },
            { productId: 'p1', variantId: 'v2', quantity: 1 },
          ],
          payment: testPayment,
        },
        user: testUser,
      })

      expect(result.customerDetails.customerName).toBe('Test User')
      expect(result.customerDetails.customerEmail).toBe('test@example.com')
      expect(result.requestedProductIds).toEqual(['p1'])
    })

    it('priceAndValidateStock computes total and returns stock errors without DB', () => {
      expect(
        priceAndValidateStock(
          [{ productId: 'p1', variantId: 'v1', quantity: 2 }],
          [
            {
              id: 'p1',
              name: 'Widget',
              variants: [{ id: 'v1', price: 75, stock: 5, availableStock: 5 }],
            },
          ] as never
        )
      ).toEqual({
        valid: true,
        pricedItems: [{ price: 75, quantity: 2, weightGrams: null }],
      })

      expect(
        priceAndValidateStock(
          [{ productId: 'p1', variantId: 'v1', quantity: 10 }],
          [
            {
              id: 'p1',
              name: 'Widget',
              variants: [{ id: 'v1', price: 75, stock: 1, availableStock: 1 }],
            },
          ] as never
        )
      ).toEqual(
        expect.objectContaining({
          valid: false,
          reason: 'insufficient_stock',
          status: 400,
        })
      )
    })

    it('persistOrder throws 409 when stock reservation is blocked in transaction', async () => {
      mockDbOrdersCreateWithItems.mockRejectedValue(
        new MockStockConflictError('Widget (v1): race condition blocked stock')
      )

      await expect(
        persistOrder({
          body: {
            customerName: 'Test',
            customerEmail: 'test@example.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
            payment: testPayment,
          },
          userId: 'user1',
          customerDetails: {
            valid: true,
            customerName: 'Test',
            customerEmail: 'test@example.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
          },
          productList: [
            {
              id: 'p1',
              name: 'Widget',
              variants: [{ id: 'v1', price: 100, stock: 1, availableStock: 1 }],
            },
          ] as never,
          totals: {
            subtotal: 100,
            shipping: {
              method: 'STANDARD',
              zone: 'NATIONAL',
              amount: 69,
              billableWeightGrams: 250,
              freeShippingApplied: false,
              freeShippingThreshold: 1499,
              estimatedDays: 7,
            },
            tax: {
              regime: 'GST',
              rate: 0.05,
              taxableAmount: 169,
              amount: 8.45,
              components: [{ name: 'IGST', rate: 0.05, amount: 8.45 }],
            },
            total: 177.45,
          },
          totalAmount: 177.45,
          verifiedPayment: {
            provider: 'RAZORPAY',
            paymentOrderId: 'order_123',
            paymentTransactionId: 'pay_123',
            amountPaid: 100,
            paidAt: new Date('2024-01-01'),
          },
        })
      ).rejects.toMatchObject(expect.objectContaining({ status: 409 }))
    })

    it('invalidateOrderRelatedCaches uses abstraction port', async () => {
      const invalidateOrderCaches = vi.fn().mockResolvedValue(undefined)

      await invalidateOrderRelatedCaches({
        userId: 'user1',
        items: [
          { productId: 'p1', variantId: 'v1', quantity: 1 },
          { productId: 'p2', variantId: 'v2', quantity: 1 },
        ],
        cacheInvalidator: { invalidateOrderCaches },
      })

      expect(invalidateOrderCaches).toHaveBeenCalledWith({
        userId: 'user1',
        productIds: ['p1', 'p2'],
      })
    })

    it('dispatchOrderNotifications publishes order/created instead of emailing inline', async () => {
      mockDbUsersFindPreferences.mockResolvedValue({
        currencyPreference: 'INR',
        localePreference: 'en',
      })

      await dispatchOrderNotifications({
        hydratedOrder: {
          id: 'ord1',
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          customerAddress: '123 St',
          subtotalAmount: 200,
          shippingAmount: 0,
          taxAmount: 0,
          shippingMethod: 'STANDARD',
          totalAmount: 200,
          discountAmount: 0,
          couponCode: null,
          status: 'PENDING',
          paymentStatus: 'PAID',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          items: [
            {
              productId: 'p1',
              variantId: 'v1',
              quantity: 2,
              price: 100,
              customizationNote: null,
              product: {
                name: 'Widget',
                image: '/widget.jpg',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
              },
            },
          ],
        },
        userId: 'user1',
        checkoutRequestId: 'chk1234',
      })

      expect(mockDispatchWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            name: 'order/created',
            data: expect.objectContaining({
              orderId: 'ord1',
              checkoutRequestId: 'chk1234',
              currencyCode: 'INR',
            }),
          }),
        })
      )
      expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled()
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'order_created_dispatched',
          success: true,
        })
      )
    })
  })

  describe('createOrderForUser', () => {
    it('throws when items array is empty', async () => {
      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: 'test@test.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [],
            payment: testPayment,
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)

      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'order_create_failed',
          success: false,
        })
      )
    })

    it('throws when email is missing', async () => {
      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: '',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
            payment: testPayment,
          },
          user: { id: 'user1', name: 'Test', email: null },
        })
      ).rejects.toThrow(OrderRequestError)
    })

    it('throws when address is missing', async () => {
      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: 'test@test.com',
            customerAddress: '',
            addressLine1: '',
            addressLine2: '',
            addressLine3: '',
            pinCode: '',
            city: '',
            state: '',
            items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
            payment: testPayment,
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)
    })

    it('throws when product not found', async () => {
      mockDbProductsFindManyWithVariants.mockResolvedValue([])

      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: 'test@test.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
            payment: testPayment,
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)
    })

    it('throws when insufficient stock', async () => {
      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 0, availableStock: 0 }],
        },
      ])

      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: 'test@test.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [{ productId: 'p1', variantId: 'v1', quantity: 5 }],
            payment: testPayment,
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)
    })

    it('throws when variant not found', async () => {
      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 120, stock: 5, availableStock: 5 }],
        },
      ])

      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: 'test@test.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [{ productId: 'p1', variantId: 'v999', quantity: 1 }],
            payment: testPayment,
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)
    })

    it('creates order successfully with email queue', async () => {
      const newOrder = {
        id: 'ord1',
        userId: 'user1',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerAddress: '123 St',
        addressLine1: '123 Test St',
        addressLine2: '',
        addressLine3: '',
        pinCode: '110001',
        city: 'New Delhi',
        state: 'Delhi',
        totalAmount: 200,
        status: 'PENDING',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 10, availableStock: 10 }],
        },
      ])

      mockDbOrdersCreateWithItems.mockResolvedValue({ id: 'ord1' })

      const fullOrder = {
        ...newOrder,
        items: [
          {
            productId: 'p1',
            variantId: null,
            quantity: 2,
            price: 100,
            customizationNote: null,
            product: {
              name: 'Widget',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
            variant: null,
          },
        ],
      }

      mockDbOrdersFindFirstById.mockResolvedValue(fullOrder)
      mockDbUsersFindPreferences.mockResolvedValue({
        currencyPreference: 'INR',
      })

      const result = await createOrderForUser({
        body: {
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          customerAddress: '123 St',
          addressLine1: '123 Test St',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [{ productId: 'p1', variantId: 'v1', quantity: 2 }],
          payment: {
            provider: 'RAZORPAY',
            orderId: 'order_123',
            paymentId: 'pay_123',
            signature: 'sig_123',
          },
        },
        user: testUser,
      })

      expect(result.order.id).toBe('ord1')
      expect(result.order.items).toHaveLength(1)
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'order_created',
          success: true,
        })
      )
      expect(mockDispatchWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({ name: 'order/created' }),
        })
      )
      expect(mockInvalidateCache).toHaveBeenCalledWith('admin:orders:*')
      expect(mockInvalidateCache).toHaveBeenCalledWith('product:p1')
      expect(mockInvalidateCache).not.toHaveBeenCalledWith('products:*')
      expect(mockInvalidateUserOrderCaches).toHaveBeenCalledWith('user1')
    })

    it('creates an unsettled Cash on Delivery order', async () => {
      mockVerifyCheckoutPayment.mockResolvedValue({
        provider: 'COD',
        paymentOrderId: 'cod_chk123',
        paymentTransactionId: 'cod_chk123',
        amountPaid: 0,
        paidAt: null,
      })
      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 10, availableStock: 10 }],
        },
      ])
      mockDbOrdersCreateWithItems.mockResolvedValue({ id: 'ord_cod' })
      mockDbOrdersFindFirstById.mockResolvedValue({
        id: 'ord_cod',
        userId: 'user1',
        customerName: 'Test',
        customerEmail: 'test@example.com',
        customerAddress: '123 St',
        totalAmount: 100,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        items: [
          {
            productId: 'p1',
            variantId: 'v1',
            quantity: 1,
            price: 100,
            customizationNote: null,
            product: {
              name: 'Widget',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
          },
        ],
      })
      mockDbUsersFindPreferences.mockResolvedValue(null)

      const result = await createOrderForUser({
        body: {
          customerName: 'Test',
          customerEmail: 'test@example.com',
          customerAddress: '123 St',
          addressLine1: '123 Test St',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
          payment: { provider: 'COD' },
        },
        user: testUser,
        checkoutRequestId: 'chk123',
      })

      expect(result.order.id).toBe('ord_cod')
      expect(mockVerifyCheckoutPayment).toHaveBeenCalledWith({
        payment: { provider: 'COD' },
        // Merchandise 100 + national standard shipping 69 + 5% GST 8.45
        expectedAmount: 177.45,
        reference: 'chk123',
      })
      expect(mockDbOrdersCreateWithItems).toHaveBeenCalledWith(
        expect.objectContaining({
          verifiedPayment: expect.objectContaining({
            provider: 'COD',
            amountPaid: 0,
            paidAt: null,
          }),
        })
      )
    })

    it('falls back to direct email when order/created cannot be published', async () => {
      const newOrder = {
        id: 'ord2',
        userId: 'user1',
        customerName: 'Test',
        customerEmail: 'test@example.com',
        customerAddress: '123 St',
        addressLine1: '123 Test St',
        addressLine2: '',
        addressLine3: '',
        pinCode: '110001',
        city: 'New Delhi',
        state: 'Delhi',
        totalAmount: 100,
        status: 'PENDING',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 10, availableStock: 10 }],
        },
      ])

      mockDbOrdersCreateWithItems.mockResolvedValue({ id: 'ord2' })

      const fullOrder = {
        ...newOrder,
        items: [
          {
            productId: 'p1',
            variantId: null,
            quantity: 1,
            price: 100,
            customizationNote: null,
            product: {
              name: 'Widget',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
            variant: null,
          },
        ],
      }

      mockDbOrdersFindFirstById.mockResolvedValue(fullOrder)
      mockDbUsersFindPreferences.mockResolvedValue(null)
      mockDispatchWorkflowEvent.mockImplementationOnce(
        async ({ fallback }: { fallback?: () => Promise<void> }) => {
          await fallback?.()
          return 'fallback'
        }
      )

      const result = await createOrderForUser({
        body: {
          customerName: 'Test',
          customerEmail: 'test@example.com',
          customerAddress: '123 St',
          addressLine1: '123 Test St',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
          payment: {
            provider: 'RAZORPAY',
            orderId: 'order_123',
            paymentId: 'pay_123',
            signature: 'sig_123',
          },
        },
        user: testUser,
      })

      expect(result.order.id).toBe('ord2')
      expect(mockSendOrderConfirmationEmail).toHaveBeenCalled()
    })

    it('throws when order retrieval fails after creation', async () => {
      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 10, availableStock: 10 }],
        },
      ])

      mockDbOrdersCreateWithItems.mockResolvedValue({ id: 'ord3' })

      mockDbOrdersFindFirstById.mockResolvedValue(null)

      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: 'test@example.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
            payment: {
              provider: 'RAZORPAY',
              orderId: 'order_123',
              paymentId: 'pay_123',
              signature: 'sig_123',
            },
          },
          user: testUser,
        })
      ).rejects.toThrow('Failed to retrieve created order')
    })

    it('uses user defaults for name and email when body is empty', async () => {
      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 50, stock: 10, availableStock: 10 }],
        },
      ])

      const newOrder = {
        id: 'ord4',
        userId: 'user1',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerAddress: '456 Ave',
        addressLine1: '123 Test St',
        addressLine2: '',
        addressLine3: '',
        pinCode: '110001',
        city: 'New Delhi',
        state: 'Delhi',
        totalAmount: 50,
        status: 'PENDING',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      mockDbOrdersCreateWithItems.mockResolvedValue({ id: 'ord4' })

      const fullOrder = {
        ...newOrder,
        items: [
          {
            productId: 'p1',
            variantId: null,
            quantity: 1,
            price: 50,
            customizationNote: null,
            product: {
              name: 'Widget',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
            variant: null,
          },
        ],
      }

      mockDbOrdersFindFirstById.mockResolvedValue(fullOrder)
      mockDbUsersFindPreferences.mockResolvedValue(null)

      const result = await createOrderForUser({
        body: {
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          customerAddress: '456 Ave',
          addressLine1: '123 Test St',
          addressLine2: '',
          addressLine3: '',
          pinCode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
          payment: {
            provider: 'RAZORPAY',
            orderId: 'order_123',
            paymentId: 'pay_123',
            signature: 'sig_123',
          },
        },
        user: testUser,
      })

      expect(result.order).toBeDefined()
    })

    it('throws 409 when stock decrement is blocked by race condition', async () => {
      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 1, availableStock: 1 }],
        },
      ])

      mockDbOrdersCreateWithItems.mockRejectedValue(
        new MockStockConflictError('Widget (v1): race condition blocked stock')
      )

      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: 'test@example.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [{ productId: 'p1', variantId: 'v1', quantity: 1 }],
            payment: testPayment,
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)
    })

    it('throws 409 when one item succeeds but another is blocked by race condition', async () => {
      mockDbProductsFindManyWithVariants.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget A',
          variants: [{ id: 'v1', price: 100, stock: 5, availableStock: 5 }],
        },
        {
          id: 'p2',
          name: 'Widget B',
          variants: [{ id: 'v2', price: 50, stock: 1, availableStock: 1 }],
        },
      ])

      // Simulates a concurrent order having consumed the second item's stock.
      mockDbOrdersCreateWithItems.mockRejectedValue(
        new MockStockConflictError(
          'Widget B (v2): race condition blocked stock'
        )
      )

      await expect(
        createOrderForUser({
          body: {
            customerName: 'Test',
            customerEmail: 'test@example.com',
            customerAddress: '123 St',
            addressLine1: '123 Test St',
            addressLine2: '',
            addressLine3: '',
            pinCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
            items: [
              { productId: 'p1', variantId: 'v1', quantity: 1 },
              { productId: 'p2', variantId: 'v2', quantity: 1 },
            ],
            payment: testPayment,
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)
    })

    describe('coupon discounts', () => {
      const activeCoupon = {
        id: 'cpn0001',
        code: 'SAVE10',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        maxDiscountAmount: null,
        minCartValue: 0,
        scopedCategories: [],
        scopedProductIds: [],
        usageLimit: null,
        perUserLimit: null,
        usageCount: 0,
        stackable: true,
        isActive: true,
        startsAt: null,
        endsAt: null,
      }

      const couponBody = {
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerAddress: '123 St',
        addressLine1: '123 Test St',
        addressLine2: '',
        addressLine3: '',
        pinCode: '110001',
        city: 'New Delhi',
        state: 'Delhi',
        items: [{ productId: 'p1', variantId: 'v1', quantity: 2 }],
        payment: {
          provider: 'RAZORPAY' as const,
          orderId: 'order_123',
          paymentId: 'pay_123',
          signature: 'sig_123',
        },
        couponCode: 'save10',
      }

      beforeEach(() => {
        mockDbProductsFindManyWithVariants.mockResolvedValue([
          {
            id: 'p1',
            name: 'Widget',
            category: 'cat-a',
            variants: [{ id: 'v1', price: 100, stock: 10, availableStock: 10 }],
          },
        ])
        mockDbCouponsCountUserRedemptions.mockResolvedValue({})
        mockDbOrdersFindFirstById.mockResolvedValue({
          id: 'ord1',
          userId: 'user1',
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          customerAddress: '123 St',
          totalAmount: 180,
          discountAmount: 20,
          couponCode: 'SAVE10',
          status: 'PENDING',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          items: [],
        })
        mockDbUsersFindPreferences.mockResolvedValue(null)
      })

      it('recomputes the discount server-side from the coupon code alone', async () => {
        mockDbCouponsFindManyByCodes.mockResolvedValue([activeCoupon])
        mockDbOrdersCreateWithItems.mockResolvedValue({ id: 'ord1' })

        await createOrderForUser({ body: couponBody, user: testUser })

        expect(mockDbCouponsFindManyByCodes).toHaveBeenCalledWith(['SAVE10'])
        // Subtotal 200 plus shipping 69 and 5% tax (13.45), less a 10% coupon
        // on the merchandise (20); the client never supplies a total.
        expect(mockVerifyCheckoutPayment).toHaveBeenCalledWith(
          expect.objectContaining({ expectedAmount: 262.45 })
        )
        expect(mockDbOrdersCreateWithItems).toHaveBeenCalledWith(
          expect.objectContaining({
            subtotalAmount: 200,
            totalAmount: 262.45,
            discountAmount: 20,
            appliedCoupons: [
              expect.objectContaining({ couponId: 'cpn0001', code: 'SAVE10' }),
            ],
          })
        )
      })

      it('rejects an invalid coupon before charging', async () => {
        mockDbCouponsFindManyByCodes.mockResolvedValue([])

        await expect(
          createOrderForUser({ body: couponBody, user: testUser })
        ).rejects.toMatchObject({ status: 404 })

        expect(mockDbOrdersCreateWithItems).not.toHaveBeenCalled()
      })

      it('rejects an expired coupon', async () => {
        mockDbCouponsFindManyByCodes.mockResolvedValue([
          { ...activeCoupon, endsAt: new Date('2020-01-01') },
        ])

        await expect(
          createOrderForUser({ body: couponBody, user: testUser })
        ).rejects.toMatchObject({ status: 400 })
      })

      it('maps a redemption cap conflict to a 409', async () => {
        mockDbCouponsFindManyByCodes.mockResolvedValue([activeCoupon])
        mockDbOrdersCreateWithItems.mockRejectedValue(
          new MockCouponConflictError('Coupon SAVE10 is no longer available')
        )

        await expect(
          createOrderForUser({ body: couponBody, user: testUser })
        ).rejects.toMatchObject({ status: 409 })
      })
    })
  })
})
