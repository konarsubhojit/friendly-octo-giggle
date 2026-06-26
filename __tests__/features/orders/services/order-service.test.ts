import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDrizzleDbQuery,
  mockPrimaryDrizzleDbQuery,
  mockPrimaryDrizzleDbInsert,
  mockPrimaryDrizzleDbUpdate,
  mockPrimaryDrizzleDbTransaction,
  mockPrimaryDrizzleDbSelect,
  mockDrizzleDbSelect,
  mockInvalidateCache,
  mockInvalidateUserOrderCaches,
  mockCacheUserOrdersList,
  mockLogBusinessEvent,
  mockLogError,
  mockSendOrderConfirmationEmail,
  mockGetQStashClient,
  mockWriteOrderToRedis,
  mockSearchOrderIds,
  mockWaitUntil,
  mockParseOffsetParam,
  mockVerifyCheckoutPayment,
} = vi.hoisted(() => ({
  mockDrizzleDbQuery: {
    orders: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    products: { findMany: vi.fn() },
    users: { findFirst: vi.fn() },
  },
  mockPrimaryDrizzleDbQuery: {
    orders: { findFirst: vi.fn() },
    products: { findMany: vi.fn() },
  },
  mockPrimaryDrizzleDbInsert: vi.fn(),
  mockPrimaryDrizzleDbUpdate: vi.fn(),
  mockPrimaryDrizzleDbTransaction: vi.fn(),
  mockPrimaryDrizzleDbSelect: vi.fn(),
  mockDrizzleDbSelect: vi.fn(),
  mockInvalidateCache: vi.fn().mockResolvedValue(undefined),
  mockInvalidateUserOrderCaches: vi.fn().mockResolvedValue(undefined),
  mockCacheUserOrdersList: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
  mockLogError: vi.fn(),
  mockSendOrderConfirmationEmail: vi.fn(),
  mockGetQStashClient: vi.fn(),
  mockWriteOrderToRedis: vi.fn().mockResolvedValue(undefined),
  mockSearchOrderIds: vi.fn(),
  mockWaitUntil: vi.fn(),
  mockParseOffsetParam: vi.fn().mockReturnValue(0),
  mockVerifyCheckoutPayment: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: mockDrizzleDbQuery,
    select: mockDrizzleDbSelect,
  },
  primaryDrizzleDb: {
    query: mockPrimaryDrizzleDbQuery,
    insert: mockPrimaryDrizzleDbInsert,
    update: mockPrimaryDrizzleDbUpdate,
    transaction: mockPrimaryDrizzleDbTransaction,
    select: mockPrimaryDrizzleDbSelect,
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
}))

vi.mock('@/lib/email', () => ({
  sendOrderConfirmationEmail: mockSendOrderConfirmationEmail,
}))

vi.mock('@/lib/qstash', () => ({
  getQStashClient: mockGetQStashClient,
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
    mockVerifyCheckoutPayment.mockResolvedValue({
      provider: 'RAZORPAY',
      paymentOrderId: 'order_123',
      paymentTransactionId: 'pay_123',
      amountPaid: 100,
      paidAt: new Date('2024-01-01'),
    })
    // Default: no existing order for the idempotency check
    mockPrimaryDrizzleDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })
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
      mockDrizzleDbQuery.orders.findMany.mockResolvedValue([])
      mockDrizzleDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 5 }]),
        }),
      })

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
              variants: [{ id: 'v1', price: 75, stock: 5 }],
            },
          ]
        )
      ).toEqual({ valid: true, totalAmount: 150 })

      expect(
        priceAndValidateStock(
          [{ productId: 'p1', variantId: 'v1', quantity: 10 }],
          [
            {
              id: 'p1',
              name: 'Widget',
              variants: [{ id: 'v1', price: 75, stock: 1 }],
            },
          ]
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
      mockPrimaryDrizzleDbTransaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'ord_helper' }]),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }
          return callback(tx)
        }
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
              variants: [{ id: 'v1', price: 100, stock: 1 }],
            },
          ],
          totalAmount: 100,
          verifiedPayment: {
            provider: 'RAZORPAY',
            paymentOrderId: 'order_123',
            paymentTransactionId: 'pay_123',
            amountPaid: 100,
            paidAt: new Date('2024-01-01'),
          },
        })
      ).rejects.toThrow(OrderRequestError)
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

    it('dispatchOrderNotifications uses publisher abstraction and queues email event', async () => {
      const publishOrderCreated = vi
        .fn()
        .mockResolvedValue({ messageId: 'msg-helper' })
      mockDrizzleDbQuery.users.findFirst.mockResolvedValue({
        currencyPreference: 'INR',
        localePreference: 'en',
      })

      await dispatchOrderNotifications({
        hydratedOrder: {
          id: 'ord1',
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          customerAddress: '123 St',
          totalAmount: 200,
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
        publisher: { publishOrderCreated },
      })

      expect(publishOrderCreated).toHaveBeenCalled()
      expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled()
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'order_email_queued',
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
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([])

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
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 0 }],
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
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 120, stock: 5 }],
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

      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 10 }],
        },
      ])

      mockPrimaryDrizzleDbTransaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([newOrder]),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([{ id: 'v1' }]),
                }),
              }),
            }),
          }
          return callback(tx)
        }
      )

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

      mockPrimaryDrizzleDbQuery.orders.findFirst.mockResolvedValue(fullOrder)
      mockDrizzleDbQuery.users.findFirst.mockResolvedValue({
        currencyPreference: 'INR',
      })
      mockGetQStashClient.mockReturnValue({
        publishJSON: vi.fn().mockResolvedValue({ messageId: 'msg1' }),
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
      expect(mockWaitUntil).toHaveBeenCalled()
      expect(mockInvalidateCache).toHaveBeenCalledWith('admin:orders:*')
      expect(mockInvalidateCache).toHaveBeenCalledWith('product:p1')
      expect(mockInvalidateCache).not.toHaveBeenCalledWith('products:*')
      expect(mockInvalidateUserOrderCaches).toHaveBeenCalledWith('user1')
    })

    it('falls back to direct email on qstash failure', async () => {
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

      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 10 }],
        },
      ])

      mockPrimaryDrizzleDbTransaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([newOrder]),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([{ id: 'v1' }]),
                }),
              }),
            }),
          }
          return callback(tx)
        }
      )

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

      mockPrimaryDrizzleDbQuery.orders.findFirst.mockResolvedValue(fullOrder)
      mockDrizzleDbQuery.users.findFirst.mockResolvedValue(null)
      mockGetQStashClient.mockReturnValue({
        publishJSON: vi.fn().mockRejectedValue(new Error('Queue down')),
      })

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
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'qstash_publish_failed_using_fallback',
        })
      )
      expect(mockSendOrderConfirmationEmail).toHaveBeenCalled()
    })

    it('throws when order retrieval fails after creation', async () => {
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 10 }],
        },
      ])

      mockPrimaryDrizzleDbTransaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'ord3' }]),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([{ id: 'v1' }]),
                }),
              }),
            }),
          }
          return callback(tx)
        }
      )

      mockPrimaryDrizzleDbQuery.orders.findFirst.mockResolvedValue(null)

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
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 50, stock: 10 }],
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

      mockPrimaryDrizzleDbTransaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([newOrder]),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([{ id: 'v1' }]),
                }),
              }),
            }),
          }
          return callback(tx)
        }
      )

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

      mockPrimaryDrizzleDbQuery.orders.findFirst.mockResolvedValue(fullOrder)
      mockDrizzleDbQuery.users.findFirst.mockResolvedValue(null)
      mockGetQStashClient.mockReturnValue({
        publishJSON: vi.fn().mockResolvedValue({ messageId: 'msg2' }),
      })

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
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          variants: [{ id: 'v1', price: 100, stock: 1 }],
        },
      ])

      mockPrimaryDrizzleDbTransaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'ord5' }]),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  // Simulates a concurrent order having already consumed the stock:
                  // gte guard matched 0 rows, so no id is returned.
                  returning: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }
          return callback(tx)
        }
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
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget A',
          variants: [{ id: 'v1', price: 100, stock: 5 }],
        },
        {
          id: 'p2',
          name: 'Widget B',
          variants: [{ id: 'v2', price: 50, stock: 1 }],
        },
      ])

      mockPrimaryDrizzleDbTransaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          let callCount = 0
          const tx = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'ord6' }]),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockImplementation(() => {
                    // First variant succeeds; second was consumed by a concurrent order.
                    callCount += 1
                    return Promise.resolve(
                      callCount === 1 ? [{ id: 'v1' }] : []
                    )
                  }),
                }),
              }),
            }),
          }
          return callback(tx)
        }
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
  })
})
