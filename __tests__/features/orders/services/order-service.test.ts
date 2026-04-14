import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDrizzleDbQuery,
  mockPrimaryDrizzleDbQuery,
  mockPrimaryDrizzleDbInsert,
  mockPrimaryDrizzleDbUpdate,
  mockPrimaryDrizzleDbTransaction,
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
    stock: 'stock',
    deletedAt: 'deletedAt',
  },
  productVariations: {
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
  type: { SQL: class {} },
}))

import type { OrderSessionUser } from '@/features/orders/services/order-service'
import {
  OrderRequestError,
  isOrderRequestError,
  getUserOrders,
  createOrderForUser,
} from '@/features/orders/services/order-service'

const testUser: OrderSessionUser = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
}

describe('order-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)
    })

    it('throws when insufficient stock', async () => {
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        { id: 'p1', name: 'Widget', price: 100, stock: 0, variations: [] },
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
          },
          user: testUser,
        })
      ).rejects.toThrow(OrderRequestError)
    })

    it('throws when variation not found', async () => {
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Widget',
          price: 100,
          stock: 10,
          variations: [{ id: 'v1', price: 120, stock: 5 }],
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
        { id: 'p1', name: 'Widget', price: 100, stock: 10, variations: [] },
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
                where: vi.fn().mockResolvedValue([]),
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
            variation: null,
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
      expect(mockInvalidateCache).toHaveBeenCalled()
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
        { id: 'p1', name: 'Widget', price: 100, stock: 10, variations: [] },
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
                where: vi.fn().mockResolvedValue([]),
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
            variation: null,
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
        { id: 'p1', name: 'Widget', price: 100, stock: 10, variations: [] },
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
                where: vi.fn().mockResolvedValue([]),
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
          },
          user: testUser,
        })
      ).rejects.toThrow('Failed to retrieve created order')
    })

    it('uses user defaults for name and email when body is empty', async () => {
      mockPrimaryDrizzleDbQuery.products.findMany.mockResolvedValue([
        { id: 'p1', name: 'Widget', price: 50, stock: 10, variations: [] },
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
                where: vi.fn().mockResolvedValue([]),
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
            variation: null,
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
        },
        user: testUser,
      })

      expect(result.order).toBeDefined()
    })
  })
})
