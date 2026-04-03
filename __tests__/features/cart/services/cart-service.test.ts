import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDrizzleDbQuery,
  mockPrimaryDrizzleDbQuery,
  mockPrimaryDrizzleDbInsert,
  mockPrimaryDrizzleDbUpdate,
  mockPrimaryDrizzleDbDelete,
  mockGetCachedData,
  mockFetchCartFromRedis,
  mockBackfillCartToRedis,
  mockRemoveCartItemsByCartId,
  mockInvalidateCartCache,
  mockLogError,
} = vi.hoisted(() => ({
  mockDrizzleDbQuery: {
    products: { findFirst: vi.fn() },
    carts: { findFirst: vi.fn() },
  },
  mockPrimaryDrizzleDbQuery: {
    carts: { findFirst: vi.fn() },
    cartItems: { findFirst: vi.fn() },
    users: { findFirst: vi.fn() },
  },
  mockPrimaryDrizzleDbInsert: vi.fn(),
  mockPrimaryDrizzleDbUpdate: vi.fn(),
  mockPrimaryDrizzleDbDelete: vi.fn(),
  mockGetCachedData: vi.fn(),
  mockFetchCartFromRedis: vi.fn(),
  mockBackfillCartToRedis: vi.fn(),
  mockRemoveCartItemsByCartId: vi.fn().mockResolvedValue(undefined),
  mockInvalidateCartCache: vi.fn().mockResolvedValue(undefined),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: { query: mockDrizzleDbQuery },
  primaryDrizzleDb: {
    query: mockPrimaryDrizzleDbQuery,
    insert: mockPrimaryDrizzleDbInsert,
    update: mockPrimaryDrizzleDbUpdate,
    delete: mockPrimaryDrizzleDbDelete,
  },
}))

vi.mock('@/lib/redis', () => ({
  getCachedData: mockGetCachedData,
}))

vi.mock('@/lib/cache', () => ({
  CACHE_KEYS: {
    CART_BY_USER: (userId: string) => `cart:user:${userId}`,
    CART_BY_SESSION: (sessionId: string) => `cart:session:${sessionId}`,
  },
  CACHE_TTL: { CART: 300, CART_STALE: 60 },
  invalidateCartCache: mockInvalidateCartCache,
}))

vi.mock('@/features/cart/services/cart-redis', () => ({
  fetchCartFromRedis: mockFetchCartFromRedis,
  backfillCartToRedis: mockBackfillCartToRedis,
  removeCartItemsByCartId: mockRemoveCartItemsByCartId,
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

vi.mock('@/lib/schema', () => ({
  products: {
    id: 'id',
    deletedAt: 'deletedAt',
  },
  carts: {
    id: 'id',
    userId: 'userId',
    sessionId: 'sessionId',
  },
  cartItems: {
    id: 'id',
    cartId: 'cartId',
    productId: 'productId',
    variationId: 'variationId',
  },
  users: { id: 'id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn(),
}))

import {
  CartRequestError,
  isCartRequestError,
  getCartIdentity,
  buildGuestSessionCookieOptions,
  getCart,
  clearCart,
} from '@/features/cart/services/cart-service'

describe('cart-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CartRequestError', () => {
    it('creates error with message and status', () => {
      const error = new CartRequestError('Not found', 404)

      expect(error.message).toBe('Not found')
      expect(error.status).toBe(404)
      expect(error.name).toBe('CartRequestError')
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('isCartRequestError', () => {
    it('returns true for CartRequestError', () => {
      const error = new CartRequestError('test', 400)
      expect(isCartRequestError(error)).toBe(true)
    })

    it('returns false for regular Error', () => {
      expect(isCartRequestError(new Error('test'))).toBe(false)
    })

    it('returns false for non-error values', () => {
      expect(isCartRequestError('string')).toBe(false)
      expect(isCartRequestError(null)).toBe(false)
      expect(isCartRequestError(undefined)).toBe(false)
      expect(isCartRequestError(42)).toBe(false)
    })
  })

  describe('getCartIdentity', () => {
    it('returns userId from session', () => {
      const result = getCartIdentity({ user: { id: 'user1' } }, 'sess1')

      expect(result).toEqual({ userId: 'user1', sessionId: 'sess1' })
    })

    it('returns sessionId when no user', () => {
      const result = getCartIdentity(null, 'sess1')

      expect(result).toEqual({ userId: undefined, sessionId: 'sess1' })
    })

    it('returns both undefined when nothing provided', () => {
      const result = getCartIdentity(null, undefined)

      expect(result).toEqual({ userId: undefined, sessionId: undefined })
    })

    it('handles session with no user', () => {
      const result = getCartIdentity({}, 'sess1')

      expect(result).toEqual({ userId: undefined, sessionId: 'sess1' })
    })
  })

  describe('buildGuestSessionCookieOptions', () => {
    it('returns cookie options with httpOnly', () => {
      const options = buildGuestSessionCookieOptions()

      expect(options.httpOnly).toBe(true)
      expect(options.sameSite).toBe('lax')
      expect(options.maxAge).toBe(60 * 60 * 24 * 30)
    })

    it('is not secure in non-production env', () => {
      const options = buildGuestSessionCookieOptions()

      expect(options.secure).toBe(false)
    })
  })

  describe('getCart', () => {
    it('returns null when no identity provided', async () => {
      const result = await getCart({})

      expect(result).toEqual({ cart: null })
    })

    it('returns null when both userId and sessionId are undefined', async () => {
      const result = await getCart({ userId: undefined, sessionId: undefined })

      expect(result).toEqual({ cart: null })
    })

    it('returns cart from Redis when available', async () => {
      const redisItems = [
        {
          itemId: 'item1',
          cartId: 'cart1',
          userId: 'user1',
          sessionId: '',
          productId: 'prod1',
          productName: 'Widget',
          productDescription: 'Desc',
          productPrice: 100,
          productImage: 'img.jpg',
          productCategory: 'Cat',
          productStock: 10,
          variationId: null,
          variationName: null,
          variationPrice: null,
          variationStock: null,
          quantity: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]
      mockFetchCartFromRedis.mockResolvedValue(redisItems)

      const result = await getCart({ userId: 'user1' })

      expect(result.cart).not.toBeNull()
      expect(result.cart!.id).toBe('cart1')
      expect(result.cart!.items).toHaveLength(1)
      expect(mockGetCachedData).not.toHaveBeenCalled()
    })

    it('falls back to cached DB when Redis returns null', async () => {
      mockFetchCartFromRedis.mockResolvedValue(null)
      const dbCart = {
        id: 'cart1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        items: [
          {
            id: 'item1',
            quantity: 1,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            product: {
              id: 'prod1',
              name: 'Widget',
              description: 'A widget',
              price: 100,
              image: 'img.jpg',
              category: 'Cat',
              stock: 10,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              variations: [],
            },
            variation: null,
          },
        ],
      }
      mockGetCachedData.mockResolvedValue(dbCart)

      const result = await getCart({ userId: 'user1' })

      expect(result.cart).not.toBeNull()
      expect(result.cart!.id).toBe('cart1')
      expect(mockBackfillCartToRedis).toHaveBeenCalled()
    })

    it('returns null when no cart found in DB', async () => {
      mockFetchCartFromRedis.mockResolvedValue(null)
      mockGetCachedData.mockResolvedValue(undefined)

      const result = await getCart({ userId: 'user1' })

      expect(result).toEqual({ cart: null })
    })

    it('returns null when Redis returns empty array', async () => {
      mockFetchCartFromRedis.mockResolvedValue([])
      mockGetCachedData.mockResolvedValue(undefined)

      const result = await getCart({ userId: 'user1' })

      expect(result).toEqual({ cart: null })
    })

    it('returns null for identity with only invalid keys', async () => {
      mockFetchCartFromRedis.mockResolvedValue(null)

      const result = await getCart({ userId: undefined, sessionId: undefined })

      expect(result).toEqual({ cart: null })
    })

    it('handles sessionId-based cart retrieval', async () => {
      const redisItems = [
        {
          itemId: 'item1',
          cartId: 'cart1',
          userId: '',
          sessionId: 'sess1',
          productId: 'prod1',
          productName: 'Widget',
          productDescription: 'Desc',
          productPrice: 100,
          productImage: 'img.jpg',
          productCategory: 'Cat',
          productStock: 10,
          variationId: 'var1',
          variationName: 'Large',
          variationPrice: 120,
          variationStock: 5,
          quantity: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]
      mockFetchCartFromRedis.mockResolvedValue(redisItems)

      const result = await getCart({ sessionId: 'sess1' })

      expect(result.cart).not.toBeNull()
      expect(result.cart!.items[0].variation).not.toBeNull()
    })
  })

  describe('clearCart', () => {
    it('does nothing when no identity provided', async () => {
      await clearCart({})

      expect(mockDrizzleDbQuery.carts.findFirst).not.toHaveBeenCalled()
    })

    it('deletes cart and clears cache for userId', async () => {
      mockDrizzleDbQuery.carts.findFirst.mockResolvedValue({
        id: 'cart1',
      })
      mockPrimaryDrizzleDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      })

      await clearCart({ userId: 'user1' })

      expect(mockPrimaryDrizzleDbDelete).toHaveBeenCalled()
      expect(mockInvalidateCartCache).toHaveBeenCalledWith('user1', undefined)
      expect(mockRemoveCartItemsByCartId).toHaveBeenCalledWith(
        'cart1',
        'user1',
        undefined
      )
    })

    it('only invalidates cache when no cart found', async () => {
      mockDrizzleDbQuery.carts.findFirst.mockResolvedValue(undefined)

      await clearCart({ userId: 'user1' })

      expect(mockPrimaryDrizzleDbDelete).not.toHaveBeenCalled()
      expect(mockInvalidateCartCache).toHaveBeenCalledWith('user1', undefined)
    })

    it('clears cart for sessionId', async () => {
      mockDrizzleDbQuery.carts.findFirst.mockResolvedValue({
        id: 'cart2',
      })
      mockPrimaryDrizzleDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      })

      await clearCart({ sessionId: 'sess1' })

      expect(mockPrimaryDrizzleDbDelete).toHaveBeenCalled()
      expect(mockRemoveCartItemsByCartId).toHaveBeenCalledWith(
        'cart2',
        undefined,
        'sess1'
      )
    })
  })
})
