import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDbCartsFindByUserId,
  mockDbCartsFindBySessionId,
  mockDbCartsFindWithItemsByUserId,
  mockDbCartsFindWithItemsBySessionId,
  mockDbCartsFindVariantStock,
  mockDbCartsPromoteToUser,
  mockDbCartsUpdateItem,
  mockDbCartsDeleteItem,
  mockDbCartsInsertItem,
  mockDbCartsUpdate,
  mockDbCartsDelete,
  mockGetCachedData,
  mockFetchCartFromRedis,
  mockBackfillCartToRedis,
  mockRemoveCartItemsByCartId,
  mockInvalidateCartCache,
  mockLogError,
} = vi.hoisted(() => ({
  mockDbCartsFindByUserId: vi.fn(),
  mockDbCartsFindBySessionId: vi.fn(),
  mockDbCartsFindWithItemsByUserId: vi.fn(),
  mockDbCartsFindWithItemsBySessionId: vi.fn(),
  mockDbCartsFindVariantStock: vi.fn().mockResolvedValue([]),
  mockDbCartsPromoteToUser: vi.fn().mockResolvedValue(undefined),
  mockDbCartsUpdateItem: vi.fn().mockResolvedValue(undefined),
  mockDbCartsDeleteItem: vi.fn().mockResolvedValue(undefined),
  mockDbCartsInsertItem: vi.fn().mockResolvedValue(undefined),
  mockDbCartsUpdate: vi.fn().mockResolvedValue(undefined),
  mockDbCartsDelete: vi.fn().mockResolvedValue(undefined),
  mockGetCachedData: vi.fn(),
  mockFetchCartFromRedis: vi.fn(),
  mockBackfillCartToRedis: vi.fn(),
  mockRemoveCartItemsByCartId: vi.fn().mockResolvedValue(undefined),
  mockInvalidateCartCache: vi.fn().mockResolvedValue(undefined),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    carts: {
      findByUserId: mockDbCartsFindByUserId,
      findBySessionId: mockDbCartsFindBySessionId,
      findWithItemsByUserId: mockDbCartsFindWithItemsByUserId,
      findWithItemsBySessionId: mockDbCartsFindWithItemsBySessionId,
      findVariantStock: mockDbCartsFindVariantStock,
      promoteToUser: mockDbCartsPromoteToUser,
      updateItem: mockDbCartsUpdateItem,
      deleteItem: mockDbCartsDeleteItem,
      insertItem: mockDbCartsInsertItem,
      update: mockDbCartsUpdate,
      delete: mockDbCartsDelete,
    },
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

import {
  CartRequestError,
  isCartRequestError,
  getCartIdentity,
  buildGuestSessionCookieOptions,
  getCart,
  clearCart,
  mergeGuestCartIntoUserCart,
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
          productImage: 'img.jpg',
          productCategory: 'Cat',
          variantId: 'v1',
          variantSku: null,
          variantPrice: 100,
          variantStock: 10,
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
              image: 'img.jpg',
              category: 'Cat',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              variants: [
                {
                  id: 'var1',
                  productId: 'prod1',
                  sku: null,
                  price: 100,
                  stock: 10,
                  image: null,
                  images: [],
                  deletedAt: null,
                  createdAt: new Date('2024-01-01'),
                  updatedAt: new Date('2024-01-01'),
                },
              ],
            },
            variant: null,
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
          productImage: 'img.jpg',
          productCategory: 'Cat',
          variantId: 'var1',
          variantSku: 'Large',
          variantPrice: 120,
          variantStock: 5,
          quantity: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]
      mockFetchCartFromRedis.mockResolvedValue(redisItems)

      const result = await getCart({ sessionId: 'sess1' })

      expect(result.cart).not.toBeNull()
      expect(result.cart!.items[0].variant).not.toBeNull()
    })

    it('user and guest DB-fetched carts produce identical serialized shapes', async () => {
      const dbCart = {
        id: 'cart1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        items: [
          {
            id: 'item1',
            variantId: 'var1',
            quantity: 2,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            product: {
              id: 'prod1',
              name: 'Widget',
              description: 'A widget',
              image: 'img.jpg',
              category: 'Cat',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              options: [
                {
                  id: 'opt1',
                  name: 'Size',
                  sortOrder: 0,
                  createdAt: new Date('2024-01-01'),
                  values: [
                    {
                      id: 'val1',
                      optionId: 'opt1',
                      value: 'Large',
                      sortOrder: 0,
                      createdAt: new Date('2024-01-01'),
                    },
                  ],
                },
              ],
              variants: [
                {
                  id: 'var1',
                  sku: 'SKU-1',
                  price: 100,
                  stock: 10,
                  image: null,
                  images: [],
                  createdAt: new Date('2024-01-01'),
                  updatedAt: new Date('2024-01-01'),
                },
              ],
            },
            variant: {
              id: 'var1',
              sku: 'SKU-1',
              price: 100,
              stock: 10,
              image: null,
              images: [],
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              optionValues: [
                {
                  optionValue: {
                    id: 'val1',
                    optionId: 'opt1',
                    value: 'Large',
                    sortOrder: 0,
                    createdAt: new Date('2024-01-01'),
                  },
                },
              ],
            },
          },
        ],
      }

      // User cart: getCachedData returns the cart for userId
      mockFetchCartFromRedis.mockResolvedValue(null)
      mockGetCachedData.mockResolvedValueOnce(dbCart)
      const userResult = await getCart({ userId: 'user1' })

      // Guest cart: getCachedData returns the same cart for sessionId
      mockFetchCartFromRedis.mockResolvedValue(null)
      mockGetCachedData.mockResolvedValueOnce(dbCart)
      const guestResult = await getCart({ sessionId: 'sess1' })

      // Both carts should be non-null and have identical serialized shapes
      expect(userResult.cart).not.toBeNull()
      expect(guestResult.cart).not.toBeNull()
      expect(userResult.cart).toEqual(guestResult.cart)
    })
  })

  describe('clearCart', () => {
    it('does nothing when no identity provided', async () => {
      await clearCart({})

      expect(mockDbCartsFindByUserId).not.toHaveBeenCalled()
    })

    it('deletes cart and clears cache for userId', async () => {
      mockDbCartsFindByUserId.mockResolvedValue({ id: 'cart1' })

      await clearCart({ userId: 'user1' })

      expect(mockDbCartsDelete).toHaveBeenCalledWith('cart1')
      expect(mockInvalidateCartCache).toHaveBeenCalledWith('user1', undefined)
      expect(mockRemoveCartItemsByCartId).toHaveBeenCalledWith(
        'cart1',
        'user1',
        undefined
      )
    })

    it('only invalidates cache when no cart found', async () => {
      mockDbCartsFindByUserId.mockResolvedValue(undefined)

      await clearCart({ userId: 'user1' })

      expect(mockDbCartsDelete).not.toHaveBeenCalled()
      expect(mockInvalidateCartCache).toHaveBeenCalledWith('user1', undefined)
    })

    it('clears cart for sessionId', async () => {
      mockDbCartsFindBySessionId.mockResolvedValue({ id: 'cart2' })

      await clearCart({ sessionId: 'sess1' })

      expect(mockDbCartsDelete).toHaveBeenCalledWith('cart2')
      expect(mockRemoveCartItemsByCartId).toHaveBeenCalledWith(
        'cart2',
        undefined,
        'sess1'
      )
    })
  })

  describe('mergeGuestCartIntoUserCart', () => {
    it('caps merged quantities to variant stock when both carts contain the same line item', async () => {
      mockDbCartsFindWithItemsBySessionId.mockResolvedValue({
        id: 'guest-cart',
        items: [
          {
            id: 'guest-item-1',
            cartId: 'guest-cart',
            productId: 'prod1',
            variantId: 'var1',
            quantity: 5,
          },
        ],
      })
      mockDbCartsFindWithItemsByUserId.mockResolvedValue({
        id: 'user-cart',
        items: [
          {
            id: 'user-item-1',
            cartId: 'user-cart',
            productId: 'prod1',
            variantId: 'var1',
            quantity: 2,
          },
        ],
      })
      mockDbCartsFindVariantStock.mockResolvedValue([
        { id: 'var1', stock: 4, deletedAt: null },
      ])

      const rotatedSessionId = await mergeGuestCartIntoUserCart(
        'user1',
        'sess1'
      )

      expect(rotatedSessionId).toMatch(/^guest_[0-9a-f-]+$/)
      expect(mockDbCartsUpdateItem).toHaveBeenCalledWith('user-item-1', 4)
      expect(mockDbCartsDelete).toHaveBeenCalledWith('guest-cart')
    })

    it('drops out-of-stock guest items while promoting guest cart to user cart', async () => {
      mockDbCartsFindWithItemsBySessionId.mockResolvedValue({
        id: 'guest-cart',
        items: [
          {
            id: 'guest-item-1',
            cartId: 'guest-cart',
            productId: 'prod1',
            variantId: 'var1',
            quantity: 2,
          },
        ],
      })
      mockDbCartsFindWithItemsByUserId.mockResolvedValue(null)
      mockDbCartsFindVariantStock.mockResolvedValue([
        { id: 'var1', stock: 0, deletedAt: null },
      ])
      mockDbCartsPromoteToUser.mockResolvedValue(undefined)

      const rotatedSessionId = await mergeGuestCartIntoUserCart(
        'user1',
        'sess1'
      )

      expect(rotatedSessionId).toMatch(/^guest_[0-9a-f-]+$/)
      expect(mockDbCartsDeleteItem).toHaveBeenCalledWith('guest-item-1')
      expect(mockDbCartsPromoteToUser).toHaveBeenCalled()
    })

    it('reassigns a guest cart to the authenticated user and returns a rotated session id', async () => {
      mockDbCartsFindWithItemsBySessionId.mockResolvedValue({
        id: 'guest-cart',
        items: [],
      })
      mockDbCartsFindWithItemsByUserId.mockResolvedValue(null)
      mockDbCartsPromoteToUser.mockResolvedValue(undefined)

      const rotatedSessionId = await mergeGuestCartIntoUserCart(
        'user1',
        'sess1'
      )

      expect(rotatedSessionId).toMatch(/^guest_[0-9a-f-]+$/)
      expect(mockDbCartsPromoteToUser).toHaveBeenCalled()
      expect(mockInvalidateCartCache).toHaveBeenCalledWith('user1')
      expect(mockInvalidateCartCache).toHaveBeenCalledWith(undefined, 'sess1')
      expect(mockRemoveCartItemsByCartId).toHaveBeenCalledWith(
        'guest-cart',
        undefined,
        'sess1'
      )
    })

    it('logs and continues when cache cleanup fails after the merge', async () => {
      mockDbCartsFindWithItemsBySessionId.mockResolvedValue({
        id: 'guest-cart',
        items: [],
      })
      mockDbCartsFindWithItemsByUserId.mockResolvedValue(null)
      mockDbCartsPromoteToUser.mockResolvedValue(undefined)
      mockInvalidateCartCache.mockRejectedValueOnce(new Error('cache failed'))

      const rotatedSessionId = await mergeGuestCartIntoUserCart(
        'user1',
        'sess1'
      )

      expect(rotatedSessionId).toMatch(/^guest_[0-9a-f-]+$/)
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'cart_merge_cache_cleanup' })
      )
    })
  })
})
