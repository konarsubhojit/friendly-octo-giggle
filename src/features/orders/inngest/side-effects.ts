import { inngest } from '@/lib/inngest/client'
import {
  orderCacheInvalidateInvoke,
  orderCacheInvalidateRequested,
  orderCreated,
  orderSearchIndexInvoke,
  orderSearchIndexRequested,
} from '@/features/orders/inngest/events'
import { SCORE_NAMES } from '@/lib/inngest/scores'

/**
 * Redis and the cache layer are both remote services on the far side of a
 * network hop. Five attempts rides out a restart without pinning a run open
 * for hours.
 */
export const SIDE_EFFECT_RETRIES = 4

/**
 * Mirror an order into Redis so it is searchable.
 *
 * This replaces `waitUntil(writeOrderToRedis(...))`, which had no retry, no
 * trace and no alert: a Redis blip silently desynchronised search from
 * Postgres and nothing surfaced it. As a durable function the same blip is a
 * retried run, and an exhausted one is a visible failure.
 *
 * Triggered by both `order/created` (the new-order path) and an explicit
 * re-index request (the status-change path), so a single implementation covers
 * every writer. The invoke trigger declares the payload a direct invocation
 * must carry: the order id alone.
 */
export const indexOrderForSearchFunction = inngest.createFunction(
  {
    id: 'index-order-for-search',
    name: 'Index order for search',
    triggers: [orderCreated, orderSearchIndexRequested, orderSearchIndexInvoke],
    retries: SIDE_EFFECT_RETRIES,
    // Serialise per order so a create and a status change racing on the same
    // row cannot interleave and leave the mirror on the older snapshot.
    concurrency: { key: 'event.data.orderId', limit: 1 },
  },
  async ({ event, step }) => {
    const { orderId } = event.data

    const outcome = await step.run('index-order', async () => {
      const { indexOrderInRedis } =
        await import('@/features/orders/services/order-mirror')
      return indexOrderInRedis(orderId)
    })

    await step.score('score-order-indexed', {
      name: SCORE_NAMES.orderIndexed,
      value: outcome === 'indexed',
    })

    if (outcome === 'order-missing') {
      // Not an error worth retrying: an order that no longer exists has
      // nothing to mirror, and the read path falls back to Postgres.
      const { logger } = await import('@/lib/logger')
      logger.warn({ orderId }, 'inngest_index_order_missing')
    }

    return { orderId, outcome }
  }
)

/**
 * Invalidate the caches an order write invalidates.
 *
 * Split out from the order-creation step so a cache outage retries on its own
 * instead of failing (or stalling) the step that persists the order.
 */
export const invalidateOrderCachesFunction = inngest.createFunction(
  {
    id: 'invalidate-order-caches',
    name: 'Invalidate order caches',
    triggers: [
      orderCreated,
      orderCacheInvalidateRequested,
      orderCacheInvalidateInvoke,
    ],
    retries: SIDE_EFFECT_RETRIES,
  },
  async ({ event, step }) => {
    const { orderId, userId, productIds } = event.data

    await step.run('invalidate-caches', async () => {
      const { invalidateOrderCaches } =
        await import('@/features/orders/services/order-cache')
      return invalidateOrderCaches({ userId, productIds })
    })

    return { orderId, invalidatedProducts: productIds.length }
  }
)
