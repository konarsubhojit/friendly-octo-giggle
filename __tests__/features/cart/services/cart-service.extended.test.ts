import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  products: { findFirstForCart: vi.fn() },
  carts: {
    findByUserId: vi.fn(),
    findBySessionId: vi.fn(),
    findWithItemsByUserId: vi.fn(),
    findWithItemsBySessionId: vi.fn(),
    findWithRelationsById: vi.fn(),
    findWithRelationsByUserId: vi.fn(),
    findWithRelationsBySessionId: vi.fn(),
    findVariantStock: vi.fn(),
    findItem: vi.fn(),
    createForSessionOrIgnore: vi.fn(),
    createForUserOrIgnore: vi.fn(),
    promoteToUser: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    insertItem: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  users: { existsById: vi.fn() },
  getCachedData: vi.fn(),
  fetchCartFromRedis: vi.fn(),
  backfillCartToRedis: vi.fn(),
  removeCartItemsByCartId: vi.fn(),
  invalidateCartCache: vi.fn(),
  logError: vi.fn(),
  createGuestCartSessionId: vi.fn(() => 'generated-session'),
}))

vi.mock('@/lib/db', () => ({
  db: { products: mocks.products, carts: mocks.carts, users: mocks.users },
}))
vi.mock('@/lib/redis', () => ({ getCachedData: mocks.getCachedData }))
vi.mock('@/lib/cache', () => ({
  CACHE_KEYS: {
    CART_BY_USER: (userId: string) => `cart:user:${userId}`,
    CART_BY_SESSION: (sessionId: string) => `cart:session:${sessionId}`,
  },
  CACHE_TTL: { CART: 300, CART_STALE: 60 },
  invalidateCartCache: mocks.invalidateCartCache,
}))
vi.mock('@/features/cart/services/cart-redis', () => ({
  fetchCartFromRedis: mocks.fetchCartFromRedis,
  backfillCartToRedis: mocks.backfillCartToRedis,
  removeCartItemsByCartId: mocks.removeCartItemsByCartId,
}))
vi.mock('@/features/cart/services/cart-session', () => ({
  createGuestCartSessionId: mocks.createGuestCartSessionId,
}))
vi.mock('@/lib/logger', () => ({ logError: mocks.logError }))

import {
  addItemToCart,
  getCart,
  mergeGuestCartIntoUserCart,
} from '@/features/cart/services/cart-service'

const NOW = new Date('2025-01-01T00:00:00.000Z')

const productRecord = {
  id: 'prod1',
  name: 'Rose',
  description: 'A rose',
  image: '/rose.jpg',
  category: 'Flowers',
  createdAt: NOW,
  updatedAt: NOW,
  options: [
    {
      id: 'opt1',
      name: 'Color',
      sortOrder: 1,
      createdAt: NOW,
      values: [
        {
          id: 'val1',
          optionId: 'opt1',
          value: 'Red',
          sortOrder: 0,
          createdAt: NOW,
        },
      ],
    },
    {
      id: 'opt2',
      name: 'Size',
      sortOrder: 0,
      createdAt: NOW,
      values: [
        {
          id: 'val2',
          optionId: 'opt2',
          value: 'L',
          sortOrder: 0,
          createdAt: NOW,
        },
      ],
    },
  ],
  variants: [{ id: 'var1', price: 10, stock: 5, createdAt: NOW, updatedAt: NOW }],
}

const cartRecord = {
  id: 'cart1',
  createdAt: NOW,
  updatedAt: '2025-01-02T00:00:00.000Z',
  items: [
    {
      id: 'item1',
      cartId: 'cart1',
      productId: 'prod1',
      variantId: 'var1',
      quantity: 2,
      createdAt: NOW,
      updatedAt: NOW,
      product: productRecord,
      variant: {
        id: 'var1',
        sku: 'SKU1',
        price: 10,
        stock: 5,
        createdAt: NOW,
        updatedAt: NOW,
        optionValues: [
          {
            optionValue: {
              id: 'val1',
              optionId: 'opt1',
              value: 'Red',
              sortOrder: 0,
              createdAt: NOW,
            },
          },
          {
            optionValue: {
              id: 'val2',
              optionId: 'opt2',
              value: 'L',
              sortOrder: 0,
              createdAt: NOW,
            },
          },
        ],
      },
    },
  ],
}

const addBody = { productId: 'prod1', variantId: 'var1', quantity: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.products.findFirstForCart.mockResolvedValue({
    id: 'prod1',
    variants: [{ id: 'var1', stock: 5 }],
  })
  mocks.carts.findItem.mockResolvedValue(undefined)
  mocks.carts.findWithRelationsById.mockResolvedValue(cartRecord)
  mocks.carts.findByUserId.mockResolvedValue({ id: 'cart1' })
  mocks.carts.findBySessionId.mockResolvedValue({ id: 'cart1' })
  mocks.carts.findVariantStock.mockResolvedValue([])
  mocks.createGuestCartSessionId.mockReturnValue('generated-session')
})

describe('addItemToCart', () => {
  it('throws when the product does not exist', async () => {
    mocks.products.findFirstForCart.mockResolvedValue(null)
    await expect(
      addItemToCart({ user: { id: 'u1' } } as never, addBody, undefined)
    ).rejects.toThrow('Product not found')
  })

  it('throws when the variant does not exist', async () => {
    mocks.products.findFirstForCart.mockResolvedValue({
      id: 'prod1',
      variants: [],
    })
    await expect(
      addItemToCart({ user: { id: 'u1' } } as never, addBody, undefined)
    ).rejects.toThrow('Variant not found')
  })

  it('throws when the variant is out of stock', async () => {
    mocks.products.findFirstForCart.mockResolvedValue({
      id: 'prod1',
      variants: [{ id: 'var1', stock: 0 }],
    })
    await expect(
      addItemToCart({ user: { id: 'u1' } } as never, addBody, undefined)
    ).rejects.toThrow('currently out of stock')
  })

  it('inserts a new item and serializes the resulting cart', async () => {
    const result = await addItemToCart(
      { user: { id: 'u1' } } as never,
      addBody,
      undefined
    )

    expect(mocks.carts.insertItem).toHaveBeenCalledWith({
      cartId: 'cart1',
      productId: 'prod1',
      variantId: 'var1',
      quantity: 1,
    })
    expect(result.warning).toBeUndefined()
    expect(result.cart.items[0]?.variantLabel).toBe('Size: L / Color: Red')
    expect(result.cart.createdAt).toBe(NOW.toISOString())
    expect(result.cart.updatedAt).toBe('2025-01-02T00:00:00.000Z')
    expect(mocks.backfillCartToRedis).toHaveBeenCalled()
  })

  it('caps a new item to the available stock and warns', async () => {
    const result = await addItemToCart({ user: { id: 'u1' } } as never, {
      ...addBody,
      quantity: 50,
    }, undefined)

    expect(result.adjustedQuantity).toBe(5)
    expect(result.warning).toContain('Only 5 items available')
  })

  it('increments an existing item', async () => {
    mocks.carts.findItem.mockResolvedValue({ id: 'item1', quantity: 1 })

    const result = await addItemToCart(
      { user: { id: 'u1' } } as never,
      addBody,
      undefined
    )

    expect(mocks.carts.updateItem).toHaveBeenCalledWith('item1', 2)
    expect(result.warning).toBeUndefined()
  })

  it('caps an existing item to the available stock', async () => {
    mocks.carts.findItem.mockResolvedValue({ id: 'item1', quantity: 3 })

    const result = await addItemToCart({ user: { id: 'u1' } } as never, {
      ...addBody,
      quantity: 10,
    }, undefined)

    expect(mocks.carts.updateItem).toHaveBeenCalledWith('item1', 5)
    expect(result.warning).toContain('Added 2 instead of 10')
  })

  it('rejects when the cart already holds the maximum quantity', async () => {
    mocks.carts.findItem.mockResolvedValue({ id: 'item1', quantity: 5 })

    await expect(
      addItemToCart({ user: { id: 'u1' } } as never, addBody, undefined)
    ).rejects.toThrow('maximum available quantity')
  })

  it('throws when the updated cart cannot be re-read', async () => {
    mocks.carts.findWithRelationsById.mockResolvedValue(undefined)

    await expect(
      addItemToCart({ user: { id: 'u1' } } as never, addBody, undefined)
    ).rejects.toThrow('Cart not found')
  })

  it('creates a user cart when none exists', async () => {
    mocks.carts.findByUserId.mockResolvedValue(undefined)
    mocks.users.existsById.mockResolvedValue(true)
    mocks.carts.createForUserOrIgnore.mockResolvedValue({ id: 'cart1' })

    await addItemToCart({ user: { id: 'u1' } } as never, addBody, undefined)

    expect(mocks.carts.createForUserOrIgnore).toHaveBeenCalledWith('u1')
  })

  it('re-reads the user cart when a concurrent insert wins the race', async () => {
    mocks.carts.findByUserId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'cart1' })
    mocks.users.existsById.mockResolvedValue(true)
    mocks.carts.createForUserOrIgnore.mockResolvedValue(undefined)

    const result = await addItemToCart(
      { user: { id: 'u1' } } as never,
      addBody,
      undefined
    )

    expect(result.sessionId).toBeUndefined()
  })

  it('throws when the raced user cart cannot be found', async () => {
    mocks.carts.findByUserId.mockResolvedValue(undefined)
    mocks.users.existsById.mockResolvedValue(true)
    mocks.carts.createForUserOrIgnore.mockResolvedValue(undefined)

    await expect(
      addItemToCart({ user: { id: 'u1' } } as never, addBody, undefined)
    ).rejects.toThrow('Failed to create user cart')
  })

  it('falls back to a guest cart when the session user is missing', async () => {
    mocks.carts.findByUserId.mockResolvedValue(undefined)
    mocks.users.existsById.mockResolvedValue(false)

    const result = await addItemToCart(
      { user: { id: 'ghost' } } as never,
      addBody,
      'guest-session'
    )

    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'cart_invalid_session_user' })
    )
    expect(result.sessionId).toBe('guest-session')
  })

  it('reuses an existing guest cart', async () => {
    const result = await addItemToCart(null, addBody, 'guest-session')

    expect(mocks.carts.findBySessionId).toHaveBeenCalledWith('guest-session')
    expect(result.sessionId).toBe('guest-session')
  })

  it('creates a guest cart with a generated session id', async () => {
    mocks.carts.findBySessionId.mockResolvedValue(undefined)
    mocks.carts.createForSessionOrIgnore.mockResolvedValue({ id: 'cart1' })

    const result = await addItemToCart(null, addBody, undefined)

    expect(result.sessionId).toBe('generated-session')
  })

  it('re-reads the guest cart when a concurrent insert wins the race', async () => {
    mocks.carts.findBySessionId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'cart1' })
    mocks.carts.createForSessionOrIgnore.mockResolvedValue(undefined)

    const result = await addItemToCart(null, addBody, 'guest-session')

    expect(result.sessionId).toBe('guest-session')
  })

  it('throws when the raced guest cart cannot be found', async () => {
    mocks.carts.findBySessionId.mockResolvedValue(undefined)
    mocks.carts.createForSessionOrIgnore.mockResolvedValue(undefined)

    await expect(addItemToCart(null, addBody, 'guest-session')).rejects.toThrow(
      'Failed to create guest cart'
    )
  })

  it('handles items without variants or product options', async () => {
    mocks.carts.findWithRelationsById.mockResolvedValue({
      ...cartRecord,
      items: [
        {
          ...cartRecord.items[0],
          variant: null,
          product: { ...productRecord, options: undefined },
        },
      ],
    })

    const result = await addItemToCart(
      { user: { id: 'u1' } } as never,
      addBody,
      undefined
    )

    expect(result.cart.items[0]?.variant).toBeNull()
    expect(result.cart.items[0]?.variantLabel).toBeNull()
  })

  it('falls back to the raw option value when the option is unknown', async () => {
    mocks.carts.findWithRelationsById.mockResolvedValue({
      ...cartRecord,
      items: [
        {
          ...cartRecord.items[0],
          variant: {
            ...cartRecord.items[0].variant,
            optionValues: [
              {
                optionValue: {
                  id: 'valX',
                  optionId: 'unknown',
                  value: 'Mystery',
                  sortOrder: 0,
                  createdAt: NOW,
                },
              },
            ],
          },
        },
      ],
    })

    const result = await addItemToCart(
      { user: { id: 'u1' } } as never,
      addBody,
      undefined
    )

    expect(result.cart.items[0]?.variantLabel).toBe('Mystery')
  })
})

describe('getCart', () => {
  it('returns null without an identity', async () => {
    await expect(getCart({ userId: undefined, sessionId: undefined })).resolves.toEqual({
      cart: null,
    })
  })

  it('builds a cart response from redis items', async () => {
    mocks.fetchCartFromRedis.mockResolvedValue([
      {
        itemId: 'item1',
        cartId: 'cart1',
        productId: 'prod1',
        productName: 'Rose',
        productDescription: 'desc',
        productImage: '/rose.jpg',
        productCategory: 'Flowers',
        variantId: 'var1',
        variantSku: 'SKU1',
        variantPrice: 10,
        variantStock: 5,
        variantOptionLabel: 'Color: Red',
        quantity: 2,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ])

    const { cart } = await getCart({ userId: 'u1', sessionId: undefined })

    expect(cart?.id).toBe('cart1')
    expect(cart?.items[0]?.variantLabel).toBe('Color: Red')
    expect(cart?.items[0]?.product.variants).toHaveLength(1)
  })

  it('returns an empty variant list when the redis item has no variant', async () => {
    mocks.fetchCartFromRedis.mockResolvedValue([
      {
        itemId: 'item1',
        cartId: 'cart1',
        productId: 'prod1',
        productName: 'Rose',
        productDescription: 'desc',
        productImage: '/rose.jpg',
        productCategory: 'Flowers',
        variantId: '',
        variantSku: null,
        variantPrice: null,
        variantStock: null,
        variantOptionLabel: null,
        quantity: 1,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ])

    const { cart } = await getCart({ userId: undefined, sessionId: 's1' })

    expect(cart?.items[0]?.product.variants).toEqual([])
    expect(cart?.items[0]?.variant).toBeNull()
  })

  it('falls back to the database and backfills redis', async () => {
    mocks.fetchCartFromRedis.mockResolvedValue([])
    mocks.getCachedData.mockImplementation(async (_key, _ttl, loader) => loader())
    mocks.carts.findWithRelationsByUserId.mockResolvedValue(cartRecord)

    const { cart } = await getCart({ userId: 'u1', sessionId: undefined })

    expect(cart?.id).toBe('cart1')
    expect(mocks.backfillCartToRedis).toHaveBeenCalled()
  })

  it('loads a guest cart by session id', async () => {
    mocks.fetchCartFromRedis.mockResolvedValue(null)
    mocks.getCachedData.mockImplementation(async (_key, _ttl, loader) => loader())
    mocks.carts.findWithRelationsBySessionId.mockResolvedValue(cartRecord)

    const { cart } = await getCart({ userId: undefined, sessionId: 's1' })

    expect(mocks.carts.findWithRelationsBySessionId).toHaveBeenCalledWith('s1')
    expect(cart?.id).toBe('cart1')
  })

  it('returns null when the database has no cart', async () => {
    mocks.fetchCartFromRedis.mockResolvedValue([])
    mocks.getCachedData.mockResolvedValue(undefined)

    await expect(getCart({ userId: 'u1', sessionId: undefined })).resolves.toEqual({
      cart: null,
    })
  })
})

describe('mergeGuestCartIntoUserCart (extended)', () => {
  it('logs cleanup failures without throwing', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue({
      id: 'user-cart',
      items: [],
    })
    mocks.invalidateCartCache.mockRejectedValueOnce(new Error('redis down'))
    mocks.invalidateCartCache.mockResolvedValue(undefined)
    mocks.removeCartItemsByCartId.mockResolvedValue(undefined)

    await expect(
      mergeGuestCartIntoUserCart('u1', 'guest-session')
    ).resolves.toBe('generated-session')
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'cart_merge_cache_cleanup' })
    )
  })

  it('treats soft-deleted variants as out of stock', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [
        {
          id: 'g1',
          cartId: 'guest',
          productId: 'p1',
          variantId: 'v1',
          quantity: 2,
        },
      ],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue({
      id: 'user-cart',
      items: [],
    })
    mocks.carts.findVariantStock.mockResolvedValue([
      { id: 'v1', stock: 10, deletedAt: NOW },
    ])
    mocks.invalidateCartCache.mockResolvedValue(undefined)
    mocks.removeCartItemsByCartId.mockResolvedValue(undefined)

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.insertItem).not.toHaveBeenCalled()
  })
})

describe('mergeGuestCartIntoUserCart (merge paths)', () => {
  const guestItem = {
    id: 'g1',
    cartId: 'guest',
    productId: 'p1',
    variantId: 'v1',
    quantity: 2,
  }

  beforeEach(() => {
    mocks.invalidateCartCache.mockResolvedValue(undefined)
    mocks.removeCartItemsByCartId.mockResolvedValue(undefined)
    mocks.carts.findVariantStock.mockResolvedValue([
      { id: 'v1', stock: 10, deletedAt: null },
    ])
  })

  it('returns undefined when there is no guest cart', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue(undefined)
    await expect(
      mergeGuestCartIntoUserCart('u1', 'guest-session')
    ).resolves.toBeUndefined()
  })

  it('inserts guest items that the user cart does not have', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue({
      id: 'user-cart',
      items: [],
    })

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.insertItem).toHaveBeenCalledWith({
      cartId: 'user-cart',
      productId: 'p1',
      variantId: 'v1',
      quantity: 2,
    })
    expect(mocks.carts.delete).toHaveBeenCalledWith('guest')
  })

  it('sums quantities for items already in the user cart', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue({
      id: 'user-cart',
      items: [{ ...guestItem, id: 'u-item', cartId: 'user-cart', quantity: 1 }],
    })

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.updateItem).toHaveBeenCalledWith('u-item', 3)
  })

  it('skips the update when the merged quantity is unchanged', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue({
      id: 'user-cart',
      items: [{ ...guestItem, id: 'u-item', cartId: 'user-cart', quantity: 1 }],
    })
    mocks.carts.findVariantStock.mockResolvedValue([
      { id: 'v1', stock: 1, deletedAt: null },
    ])

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.updateItem).not.toHaveBeenCalled()
  })

  it('deletes the user item when no stock remains', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue({
      id: 'user-cart',
      items: [{ ...guestItem, id: 'u-item', cartId: 'user-cart', quantity: 1 }],
    })
    mocks.carts.findVariantStock.mockResolvedValue([])

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.deleteItem).toHaveBeenCalledWith('u-item')
  })

  it('promotes the guest cart when the user has no cart', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue(undefined)
    mocks.carts.promoteToUser.mockResolvedValue(undefined)

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.promoteToUser).toHaveBeenCalledWith(
      'guest',
      'u1',
      expect.any(Date)
    )
    expect(mocks.carts.updateItem).not.toHaveBeenCalled()
  })

  it('caps promoted item quantities to available stock', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue(undefined)
    mocks.carts.promoteToUser.mockResolvedValue(undefined)
    mocks.carts.findVariantStock.mockResolvedValue([
      { id: 'v1', stock: 1, deletedAt: null },
    ])

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.updateItem).toHaveBeenCalledWith('g1', 1)
  })

  it('deletes promoted items that are out of stock', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue(undefined)
    mocks.carts.promoteToUser.mockResolvedValue(undefined)
    mocks.carts.findVariantStock.mockResolvedValue([])

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.deleteItem).toHaveBeenCalledWith('g1')
  })

  it.each([
    ['a pg error code', Object.assign(new Error('conflict'), { code: '23505' })],
    ['a wrapped error code', new Error('failed with 23505')],
    ['a duplicate key message', new Error('duplicate key value violates')],
  ])('falls back to a merge on %s', async (_label, error) => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'user-cart', items: [] })
    mocks.carts.promoteToUser.mockRejectedValue(error)

    await mergeGuestCartIntoUserCart('u1', 'guest-session')

    expect(mocks.carts.insertItem).toHaveBeenCalled()
  })

  it('throws when the raced user cart disappears', async () => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue(undefined)
    mocks.carts.promoteToUser.mockRejectedValue(
      Object.assign(new Error('conflict'), { code: '23505' })
    )

    await expect(
      mergeGuestCartIntoUserCart('u1', 'guest-session')
    ).rejects.toThrow('Failed to merge guest cart after concurrent write')
  })

  it.each([
    ['a non-object rejection', 'boom'],
    ['an unrelated error', new Error('network down')],
  ])('rethrows %s from the promotion', async (_label, error) => {
    mocks.carts.findWithItemsBySessionId.mockResolvedValue({
      id: 'guest',
      items: [guestItem],
    })
    mocks.carts.findWithItemsByUserId.mockResolvedValue(undefined)
    mocks.carts.promoteToUser.mockRejectedValue(error)

    await expect(
      mergeGuestCartIntoUserCart('u1', 'guest-session')
    ).rejects.toBeTruthy()
  })
})
