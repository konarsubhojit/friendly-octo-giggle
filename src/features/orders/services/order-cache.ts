/**
 * Cache invalidation for the order read path.
 *
 * The same three-part invalidation (admin order lists, the customer's own
 * order caches, and each affected product) was previously open-coded at four
 * call sites. Centralising it means the durable
 * `invalidate-order-caches` Inngest function and the inline callers can never
 * drift apart.
 */

import { invalidateCache } from '@/lib/redis'
import { invalidateUserOrderCaches } from '@/lib/cache'

export interface InvalidateOrderCachesInput {
  readonly userId?: string | null
  readonly productIds?: readonly string[]
}

/**
 * Invalidate every cache entry affected by an order write.
 *
 * Rejects if any invalidation fails so durable callers can retry; callers on
 * the request path should keep wrapping this in their own error handling.
 */
export const invalidateOrderCaches = async ({
  userId,
  productIds = [],
}: InvalidateOrderCachesInput): Promise<void> => {
  const uniqueProductIds = [...new Set(productIds)]

  await Promise.all([
    invalidateCache('admin:orders:*'),
    ...(userId ? [invalidateUserOrderCaches(userId)] : []),
    ...uniqueProductIds.map((productId) =>
      invalidateCache(`product:${productId}`)
    ),
  ])
}
