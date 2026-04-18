import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_PRODUCT_ID = 'prod001'
const VALID_CART_ID = 'cart001'
const VALID_ITEM_ID = 'item001'
const VALID_VARIANT_ID_TOP = 'var0001'

const mockPrimaryDrizzleDb = vi.hoisted(() => ({
  query: {
    products: { findFirst: vi.fn() },
    carts: { findFirst: vi.fn() },
    cartItems: { findFirst: vi.fn() },
    users: { findFirst: vi.fn() },
  },
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  delete: vi.fn(() => ({ where: vi.fn() })),
}))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: mockPrimaryDrizzleDb,
  drizzleDb: mockPrimaryDrizzleDb,
}))

vi.mock('@/lib/schema', () => ({
  products: { id: 'id', deletedAt: 'deletedAt' },
  users: { id: 'id' },
  carts: { userId: 'userId', sessionId: 'sessionId', id: 'id' },
  cartItems: {
    cartId: 'cartId',
    productId: 'productId',
    variantId: 'variantId',
    id: 'id',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

vi.mock('@/lib/redis', () => ({
  getCachedData: vi.fn(),
  getRedisClient: vi.fn(() => null),
}))

vi.mock('@/features/cart/services/cart-redis', () => ({
  fetchCartFromRedis: vi.fn(() => Promise.resolve(null)),
  backfillCartToRedis: vi.fn(),
  removeCartItemsByCartId: vi.fn(() => Promise.resolve()),
  writeCartItemToRedis: vi.fn(() => Promise.resolve()),
  writeCartItemsToRedis: vi.fn(() => Promise.resolve()),
  updateCartItemQuantityInRedis: vi.fn(() => Promise.resolve()),
  removeCartItemFromRedis: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/cache', () => ({
  CACHE_KEYS: {
    CART_BY_USER: (id: string) => `cart:user:${id}`,
    CART_BY_SESSION: (id: string) => `cart:session:${id}`,
  },
  CACHE_TTL: { CART: 30, CART_STALE: 5 },
  invalidateCartCache: vi.fn(),
}))

vi.mock('@/lib/validations', async () => {
  const actual = await vi.importActual('@/lib/validations')
  return actual
})

import { drizzleDb } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getCachedData } from '@/lib/redis'
import { invalidateCartCache } from '@/lib/cache'
import { logError } from '@/lib/logger'

import { GET, POST, DELETE } from '@/app/api/cart/route'

describe('Cart API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/cart', () => {
    it('returns null cart when no user and no session cookie', async () => {
      ;(auth as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ cart: null })
      expect(getCachedData).not.toHaveBeenCalled()
    })

    it('returns cart for authenticated user', async () => {
      const mockCart = {
        id: 'cart1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        items: [
          {
            id: 'item1',
            quantity: 2,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            product: {
              id: 'prod1',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-02'),
              variants: [],
            },
            variant: null,
          },
        ],
      }

      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(getCachedData as Mock).mockResolvedValue(mockCart)

      const request = new NextRequest('http://localhost/api/cart')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cart).toBeDefined()
      expect(data.cart.id).toBe('cart1')
      expect(data.cart.items).toHaveLength(1)
      expect(getCachedData).toHaveBeenCalledWith(
        'cart:user:user123',
        30,
        expect.any(Function),
        5
      )
    })

    it('returns cart for guest with session cookie', async () => {
      const mockCart = {
        id: 'cart2',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        items: [],
      }

      ;(auth as Mock).mockResolvedValue(null)
      ;(getCachedData as Mock).mockResolvedValue(mockCart)

      const request = new NextRequest('http://localhost/api/cart', {
        headers: { cookie: 'cart_session=guest123' },
      })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cart).toBeDefined()
      expect(data.cart.id).toBe('cart2')
      expect(getCachedData).toHaveBeenCalledWith(
        'cart:session:guest123',
        30,
        expect.any(Function),
        5
      )
    })

    it('returns null cart when getCachedData returns undefined', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(getCachedData as Mock).mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost/api/cart')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ cart: null })
    })

    it('returns 500 on error', async () => {
      ;(auth as Mock).mockRejectedValue(new Error('Auth failed'))

      const request = new NextRequest('http://localhost/api/cart')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to fetch cart' })
      expect(logError).toHaveBeenCalled()
    })
  })

  describe('POST /api/cart', () => {
    it('returns 400 for invalid input (no productId)', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({ quantity: 1 }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('returns 404 when product not found', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 1,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ error: 'Product not found' })
    })

    it('returns 400 for out of stock product', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID_TOP, stock: 0 }],
      })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 10,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ error: 'This product is currently out of stock' })
    })

    it('creates cart item for authenticated user (201)', async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        items: [
          {
            id: VALID_ITEM_ID,
            quantity: 1,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            product: {
              id: VALID_PRODUCT_ID,
              name: 'Test Product',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-02'),
              variants: [],
            },
            variant: null,
          },
        ],
      }

      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID_TOP, stock: 10 }],
      })
      ;(drizzleDb.query.carts.findFirst as Mock)
        .mockResolvedValueOnce({ id: VALID_CART_ID })
        .mockResolvedValueOnce(mockCart)
      ;(drizzleDb.query.users.findFirst as Mock).mockResolvedValue({
        id: 'user123',
      })
      ;(drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue(null)
      const insertValuesMock = vi.fn(() => ({ returning: vi.fn() }))
      ;(drizzleDb.insert as Mock).mockReturnValue({ values: insertValuesMock })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 1,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.cart).toBeDefined()
      expect(data.cart.id).toBe(VALID_CART_ID)
      expect(invalidateCartCache).toHaveBeenCalledWith('user123', undefined)
    })

    it('creates new cart for guest user', async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        items: [],
      }

      ;(auth as Mock).mockResolvedValue(null)
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID_TOP, stock: 10 }],
      })
      ;(drizzleDb.query.carts.findFirst as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCart)
      const insertReturningMock = vi
        .fn()
        .mockResolvedValue([{ id: VALID_CART_ID }])
      const insertValuesMock = vi.fn(() => ({
        returning: insertReturningMock,
      }))
      ;(drizzleDb.insert as Mock).mockReturnValue({ values: insertValuesMock })
      ;(drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 1,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.cart).toBeDefined()
      const setCookie = response.headers.get('set-cookie')
      expect(setCookie).toContain('cart_session=')
    })

    it('falls back to guest cart when authenticated user no longer exists', async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        items: [],
      }

      ;(auth as Mock).mockResolvedValue({ user: { id: 'missing-user' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID_TOP, stock: 10 }],
      })
      ;(drizzleDb.query.carts.findFirst as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCart)
      ;(drizzleDb.query.users.findFirst as Mock).mockResolvedValue(null)
      ;(drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue(null)

      const insertReturningMock = vi
        .fn()
        .mockResolvedValue([{ id: VALID_CART_ID }])
      const insertValuesMock = vi.fn(() => ({
        returning: insertReturningMock,
      }))
      ;(drizzleDb.insert as Mock).mockReturnValue({ values: insertValuesMock })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 1,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.cart).toBeDefined()
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'cart_invalid_session_user' })
      )
      const setCookie = response.headers.get('set-cookie')
      expect(setCookie).toContain('cart_session=')
    })

    it('returns 500 on error', async () => {
      ;(auth as Mock).mockRejectedValue(new Error('Auth failed'))

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 1,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to add to cart' })
      expect(logError).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/cart', () => {
    it('clears cart for authenticated user', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.carts.findFirst as Mock).mockResolvedValue({
        id: 'cart1',
      })
      const deleteWhereMock = vi.fn()
      ;(drizzleDb.delete as Mock).mockReturnValue({ where: deleteWhereMock })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'DELETE',
      })
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ success: true })
      expect(drizzleDb.delete).toHaveBeenCalled()
      expect(invalidateCartCache).toHaveBeenCalledWith('user123', undefined)
    })

    it('clears cart for guest user with session', async () => {
      ;(auth as Mock).mockResolvedValue(null)
      ;(drizzleDb.query.carts.findFirst as Mock).mockResolvedValue({
        id: 'cart2',
      })
      const deleteWhereMock = vi.fn()
      ;(drizzleDb.delete as Mock).mockReturnValue({ where: deleteWhereMock })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'DELETE',
        headers: { cookie: 'cart_session=guest123' },
      })
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ success: true })
      expect(invalidateCartCache).toHaveBeenCalledWith(undefined, 'guest123')
      const setCookie = response.headers.get('set-cookie')
      expect(setCookie).toContain('cart_session=')
    })

    it('returns success when no user and no session', async () => {
      ;(auth as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'DELETE',
      })
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ success: true })
      expect(drizzleDb.query.carts.findFirst).not.toHaveBeenCalled()
      expect(drizzleDb.delete).not.toHaveBeenCalled()
    })

    it('returns success when cart not found', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.carts.findFirst as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'DELETE',
      })
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ success: true })
      expect(drizzleDb.delete).not.toHaveBeenCalled()
      expect(invalidateCartCache).toHaveBeenCalled()
    })

    it('returns 500 on error', async () => {
      ;(auth as Mock).mockRejectedValue(new Error('Auth failed'))

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'DELETE',
      })
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Failed to clear cart' })
      expect(logError).toHaveBeenCalled()
    })
  })

  describe('POST /api/cart - additional edge cases', () => {
    const VALID_VARIANT_ID = 'var0001'

    it('returns 404 when variant not found', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID, stock: 5 }],
      })

      const otherVariantId = 'var0002'
      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          quantity: 1,
          variantId: otherVariantId,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ error: 'Variant not found' })
    })

    it('auto-caps quantity when variant stock is insufficient', async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        items: [
          {
            id: VALID_ITEM_ID,
            quantity: 2,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            product: {
              id: VALID_PRODUCT_ID,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-02'),
              variants: [
                {
                  id: VALID_VARIANT_ID,
                  stock: 2,
                  createdAt: new Date('2024-01-01'),
                  updatedAt: new Date('2024-01-02'),
                },
              ],
            },
            variant: {
              id: VALID_VARIANT_ID,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-02'),
            },
          },
        ],
      }

      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID, stock: 2 }],
      })
      ;(drizzleDb.query.carts.findFirst as Mock)
        .mockResolvedValueOnce({ id: VALID_CART_ID })
        .mockResolvedValueOnce(mockCart)
      ;(drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue(null)
      const insertValuesMock = vi.fn(() => ({ returning: vi.fn() }))
      ;(drizzleDb.insert as Mock).mockReturnValue({ values: insertValuesMock })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          quantity: 5,
          variantId: VALID_VARIANT_ID,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.cart).toBeDefined()
      expect(data.warning).toBe('Only 2 items available. Added 2 to your cart.')
      expect(data.adjustedQuantity).toBe(2)
    })

    it('updates existing cart item quantity', async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        items: [
          {
            id: VALID_ITEM_ID,
            quantity: 3,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            product: {
              id: VALID_PRODUCT_ID,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-02'),
              variants: [],
            },
            variant: null,
          },
        ],
      }

      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID_TOP, stock: 10 }],
      })
      ;(drizzleDb.query.carts.findFirst as Mock)
        .mockResolvedValueOnce({ id: VALID_CART_ID })
        .mockResolvedValueOnce(mockCart)
      ;(drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue({
        id: VALID_ITEM_ID,
        quantity: 2,
        variantId: VALID_VARIANT_ID_TOP,
      })
      const updateWhereMock = vi.fn()
      const updateSetMock = vi.fn(() => ({ where: updateWhereMock }))
      ;(drizzleDb.update as Mock).mockReturnValue({ set: updateSetMock })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 1,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.cart).toBeDefined()
      expect(drizzleDb.update).toHaveBeenCalled()
    })

    it('returns 400 when cart already has maximum available stock', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID_TOP, stock: 5 }],
      })
      ;(drizzleDb.query.carts.findFirst as Mock).mockResolvedValueOnce({
        id: VALID_CART_ID,
      })
      ;(drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue({
        id: VALID_ITEM_ID,
        quantity: 5,
        variantId: VALID_VARIANT_ID_TOP,
      })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 3,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('maximum available quantity (5)')
    })

    it('returns 404 when updated cart not found after insert', async () => {
      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        variants: [{ id: VALID_VARIANT_ID_TOP, stock: 10 }],
      })
      ;(drizzleDb.query.carts.findFirst as Mock)
        .mockResolvedValueOnce({ id: VALID_CART_ID })
        .mockResolvedValueOnce(null)
      ;(drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue(null)
      const insertValuesMock = vi.fn(() => ({ returning: vi.fn() }))
      ;(drizzleDb.insert as Mock).mockReturnValue({ values: insertValuesMock })

      const request = new NextRequest('http://localhost/api/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: VALID_PRODUCT_ID,
          variantId: VALID_VARIANT_ID_TOP,
          quantity: 1,
        }),
        headers: { 'content-type': 'application/json' },
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ error: 'Cart not found' })
    })

    it('serializes cart with variant data', async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        items: [
          {
            id: VALID_ITEM_ID,
            quantity: 1,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            product: {
              id: VALID_PRODUCT_ID,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-02'),
              variants: [
                {
                  id: 'var1',
                  createdAt: new Date('2024-01-01'),
                  updatedAt: new Date('2024-01-02'),
                },
              ],
            },
            variant: {
              id: 'var1',
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-02'),
            },
          },
        ],
      }

      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(getCachedData as Mock).mockResolvedValue(mockCart)

      const request = new NextRequest('http://localhost/api/cart')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cart.items[0].variant).toBeDefined()
      expect(data.cart.items[0].variant.createdAt).toBe(
        '2024-01-01T00:00:00.000Z'
      )
      expect(data.cart.items[0].product.variants[0].createdAt).toBe(
        '2024-01-01T00:00:00.000Z'
      )
    })

    it('serializes cart with string dates from cache', async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        items: [
          {
            id: VALID_ITEM_ID,
            quantity: 1,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
            product: {
              id: VALID_PRODUCT_ID,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-02T00:00:00.000Z',
              variants: [],
            },
            variant: null,
          },
        ],
      }

      ;(auth as Mock).mockResolvedValue({ user: { id: 'user123' } })
      ;(getCachedData as Mock).mockResolvedValue(mockCart)

      const request = new NextRequest('http://localhost/api/cart')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.cart.createdAt).toBe('2024-01-01T00:00:00.000Z')
      expect(data.cart.items[0].createdAt).toBe('2024-01-01T00:00:00.000Z')
    })
  })
})
