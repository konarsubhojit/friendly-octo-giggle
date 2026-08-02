import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/redis', () => ({
  invalidateCache: vi.fn(),
}))

vi.mock('@/lib/cache', () => ({
  invalidateUserOrderCaches: vi.fn(),
}))

vi.mock('@/lib/cache-tags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cache-tags')>()),
  revalidateCacheTags: vi.fn(),
}))

import { invalidateOrderCaches } from '@/features/orders/services/order-cache'
import { invalidateCache } from '@/lib/redis'
import { invalidateUserOrderCaches } from '@/lib/cache'
import {
  bestsellersTag,
  productTag,
  revalidateCacheTags,
} from '@/lib/cache-tags'

const mockInvalidateCache = vi.mocked(invalidateCache)
const mockRevalidateCacheTags = vi.mocked(revalidateCacheTags)

describe('invalidateOrderCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvalidateCache.mockResolvedValue(undefined)
  })

  it('revalidates the bestsellers tag and one tag per affected product', async () => {
    await invalidateOrderCaches({
      userId: 'user-1',
      productIds: ['p1', 'p2'],
    })

    expect(mockRevalidateCacheTags).toHaveBeenCalledWith(
      [bestsellersTag(), productTag('p1'), productTag('p2')],
      'invalidate_order_caches'
    )
  })

  it('de-duplicates repeated product ids', async () => {
    await invalidateOrderCaches({ productIds: ['p1', 'p1', 'p2'] })

    expect(mockRevalidateCacheTags).toHaveBeenCalledWith(
      [bestsellersTag(), productTag('p1'), productTag('p2')],
      'invalidate_order_caches'
    )
  })

  it('revalidates the bestsellers tag even when no products are supplied', async () => {
    await invalidateOrderCaches({ userId: 'user-1' })

    expect(mockRevalidateCacheTags).toHaveBeenCalledWith(
      [bestsellersTag()],
      'invalidate_order_caches'
    )
  })

  it('still invalidates the Redis order caches', async () => {
    await invalidateOrderCaches({ userId: 'user-1', productIds: ['p1'] })

    expect(mockInvalidateCache).toHaveBeenCalledWith('admin:orders:*')
    expect(mockInvalidateCache).toHaveBeenCalledWith('product:p1')
    expect(invalidateUserOrderCaches).toHaveBeenCalledWith('user-1')
  })

  it('rejects when a Redis invalidation fails so durable callers can retry', async () => {
    mockInvalidateCache.mockRejectedValueOnce(new Error('Redis down'))

    await expect(invalidateOrderCaches({ userId: 'user-1' })).rejects.toThrow(
      'Redis down'
    )

    // Tags are revalidated before the Redis work, so a Redis outage never
    // leaves the prerendered catalog stale.
    expect(mockRevalidateCacheTags).toHaveBeenCalled()
  })
})
