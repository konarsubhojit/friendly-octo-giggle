import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPipeline = {
  hset: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  sadd: vi.fn().mockReturnThis(),
  del: vi.fn().mockReturnThis(),
  srem: vi.fn().mockReturnThis(),
  hgetall: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
}

const mockRedisClient = {
  pipeline: vi.fn(() => mockPipeline),
  del: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  hset: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
}

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logCacheOperation: vi.fn(),
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn((promise: Promise<unknown>) => promise),
}))

import {
  writeCartItemToRedis,
  writeCartItemsToRedis,
  removeCartItemFromRedis,
  removeCartItemsByCartId,
  updateCartItemQuantityInRedis,
  fetchCartFromRedis,
  backfillCartToRedis,
  type CartItemRedis,
} from '@/features/cart/services/cart-redis'
import { getRedisClient } from '@/lib/redis'
import { logError } from '@/lib/logger'

const createCartItem = (
  overrides: Partial<CartItemRedis> = {}
): CartItemRedis => ({
  itemId: 'item1',
  cartId: 'cart1',
  userId: 'user1',
  sessionId: 'sess1',
  productId: 'prod1',
  productName: 'Test Product',
  productDescription: 'A test product',
  productImage: 'https://example.com/img.jpg',
  productCategory: 'Test',
  variantId: 'v1',
  variantSku: null,
  variantPrice: 100,
  variantStock: 10,
  quantity: 2,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('cart-redis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('writeCartItemToRedis', () => {
    it('writes item to redis with pipeline', async () => {
      await writeCartItemToRedis(createCartItem())

      expect(mockRedisClient.pipeline).toHaveBeenCalled()
      expect(mockPipeline.hset).toHaveBeenCalled()
      expect(mockPipeline.expire).toHaveBeenCalled()
      expect(mockPipeline.sadd).toHaveBeenCalled()
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    it('returns early when redis is not available', async () => {
      vi.mocked(getRedisClient).mockReturnValueOnce(null as never)

      await writeCartItemToRedis(createCartItem())

      expect(mockRedisClient.pipeline).not.toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      mockPipeline.exec.mockRejectedValueOnce(new Error('Redis error'))

      await writeCartItemToRedis(createCartItem())

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'cart_redis_write' })
      )
    })

    it('skips owner set when no userId or sessionId', async () => {
      await writeCartItemToRedis(createCartItem({ userId: '', sessionId: '' }))

      expect(mockPipeline.sadd).not.toHaveBeenCalled()
    })
  })

  describe('writeCartItemsToRedis', () => {
    it('writes multiple items in batch', async () => {
      const items = [createCartItem(), createCartItem({ itemId: 'item2' })]
      await writeCartItemsToRedis(items)

      expect(mockPipeline.hset).toHaveBeenCalledTimes(2)
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    it('returns early for empty array', async () => {
      await writeCartItemsToRedis([])

      expect(mockRedisClient.pipeline).not.toHaveBeenCalled()
    })

    it('returns early when redis is not available', async () => {
      vi.mocked(getRedisClient).mockReturnValueOnce(null as never)

      await writeCartItemsToRedis([createCartItem()])

      expect(mockRedisClient.pipeline).not.toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      mockPipeline.exec.mockRejectedValueOnce(new Error('Redis error'))

      await writeCartItemsToRedis([createCartItem()])

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'cart_redis_batch_write' })
      )
    })
  })

  describe('removeCartItemFromRedis', () => {
    it('deletes item key from redis', async () => {
      await removeCartItemFromRedis('item1')

      expect(mockRedisClient.del).toHaveBeenCalledWith('cartitem:item1')
    })

    it('returns early when redis is not available', async () => {
      vi.mocked(getRedisClient).mockReturnValueOnce(null as never)

      await removeCartItemFromRedis('item1')

      expect(mockRedisClient.del).not.toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      mockRedisClient.del.mockRejectedValueOnce(new Error('Redis error'))

      await removeCartItemFromRedis('item1')

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'cart_redis_delete' })
      )
    })
  })

  describe('removeCartItemsByCartId', () => {
    it('removes all items for a user', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['item1', 'item2'])

      await removeCartItemsByCartId('cart1', 'user1')

      expect(mockPipeline.del).toHaveBeenCalledTimes(3)
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    it('returns early with no owner key', async () => {
      await removeCartItemsByCartId('cart1')

      expect(mockRedisClient.smembers).not.toHaveBeenCalled()
    })

    it('returns early when no items found', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([])

      await removeCartItemsByCartId('cart1', 'user1')

      expect(mockRedisClient.pipeline).not.toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      mockRedisClient.smembers.mockRejectedValueOnce(new Error('Redis error'))

      await removeCartItemsByCartId('cart1', 'user1')

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'cart_redis_clear' })
      )
    })

    it('works with sessionId instead of userId', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['item1'])

      await removeCartItemsByCartId('cart1', undefined, 'sess1')

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        'cartowner:session:sess1'
      )
    })
  })

  describe('updateCartItemQuantityInRedis', () => {
    it('updates quantity in redis hash', async () => {
      await updateCartItemQuantityInRedis('item1', 5)

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        'cartitem:item1',
        expect.objectContaining({ quantity: '5' })
      )
      expect(mockRedisClient.expire).toHaveBeenCalled()
    })

    it('returns early when redis is not available', async () => {
      vi.mocked(getRedisClient).mockReturnValueOnce(null as never)

      await updateCartItemQuantityInRedis('item1', 5)

      expect(mockRedisClient.hset).not.toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      mockRedisClient.hset.mockRejectedValueOnce(new Error('Redis error'))

      await updateCartItemQuantityInRedis('item1', 5)

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'cart_redis_update_quantity' })
      )
    })
  })

  describe('fetchCartFromRedis', () => {
    it('returns items from redis', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['item1'])
      mockPipeline.exec.mockResolvedValueOnce([
        {
          itemId: 'item1',
          cartId: 'cart1',
          userId: 'user1',
          sessionId: 'sess1',
          productId: 'prod1',
          productName: 'Test',
          productDescription: 'Desc',
          productImage: 'img.jpg',
          productCategory: 'Cat',
          variantId: 'v1',
          variantSku: '',
          variantPrice: '100',
          variantStock: '10',
          quantity: '2',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ])

      const result = await fetchCartFromRedis('user1')

      expect(result).toHaveLength(1)
      expect(result![0].itemId).toBe('item1')
      expect(result![0].variantPrice).toBe(100)
    })

    it('returns null when redis is not available', async () => {
      vi.mocked(getRedisClient).mockReturnValueOnce(null as never)

      const result = await fetchCartFromRedis('user1')

      expect(result).toBeNull()
    })

    it('returns null when no owner key can be built', async () => {
      const result = await fetchCartFromRedis()

      expect(result).toBeNull()
    })

    it('returns null when no items in set', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([])

      const result = await fetchCartFromRedis('user1')

      expect(result).toBeNull()
    })

    it('cleans up expired items', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce(['item1', 'item2'])
      mockPipeline.exec.mockResolvedValueOnce([
        {
          itemId: 'item1',
          cartId: 'cart1',
          userId: 'user1',
          sessionId: '',
          productId: 'p1',
          productName: 'T',
          productDescription: 'D',
          variantPrice: '10',
          productImage: 'i',
          productCategory: 'C',
          variantStock: '5',
          quantity: '1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        null,
      ])

      const cleanupPipeline = {
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }
      mockRedisClient.pipeline
        .mockReturnValueOnce(mockPipeline as never)
        .mockReturnValueOnce(cleanupPipeline as never)

      const result = await fetchCartFromRedis('user1')

      expect(result).toHaveLength(1)
    })

    it('handles errors gracefully', async () => {
      mockRedisClient.smembers.mockRejectedValueOnce(new Error('Redis error'))

      const result = await fetchCartFromRedis('user1')

      expect(result).toBeNull()
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'cart_redis_fetch' })
      )
    })

    it('works with sessionId', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([])

      await fetchCartFromRedis(undefined, 'sess1')

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        'cartowner:session:sess1'
      )
    })
  })

  describe('backfillCartToRedis', () => {
    it('calls waitUntil with writeCartItemsToRedis', async () => {
      const { waitUntil } = await import('@vercel/functions')
      backfillCartToRedis([createCartItem()])
      expect(waitUntil).toHaveBeenCalled()
    })
  })
})
