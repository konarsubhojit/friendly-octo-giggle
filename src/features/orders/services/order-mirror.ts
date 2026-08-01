/**
 * Redis mirror of the orders table.
 *
 * Orders are served from Redis on the read path and searched through Redis
 * Search, so every write to Postgres has to be reflected here. The mirror
 * lives in its own module — rather than inside the `'use server'` actions file
 * it grew up in — so durable Inngest functions can import it without pulling a
 * server-action bundle into a route handler.
 */

import { db } from '@/lib/db'
import { getRedisClient } from '@/lib/redis'
import { logError } from '@/lib/logger'

export interface OrderItemRecord {
  productId: string
  variantId?: string | null
  quantity: number
  price: number
  customizationNote?: string | null
}

export interface OrderSummary {
  id: string
  userId: string | null
  customerName: string
  customerEmail: string
  customerAddress: string
  addressLine1?: string | null
  addressLine2?: string | null
  addressLine3?: string | null
  pinCode?: string | null
  city?: string | null
  state?: string | null
  total: number
  status: string
  items: OrderItemRecord[]
  createdAt: string
  productNames?: string
}

export const redisOrderKey = (orderId: string) => `order:${orderId}`
export const redisUserOrdersKey = (userId: string) => `user:orders:${userId}`

interface OrderWithItemsRow {
  readonly id: string
  readonly userId: string | null
  readonly customerName: string
  readonly customerEmail: string
  readonly customerAddress: string
  readonly addressLine1: string | null
  readonly addressLine2: string | null
  readonly addressLine3: string | null
  readonly pinCode: string | null
  readonly city: string | null
  readonly state: string | null
  readonly totalAmount: number
  readonly status: string
  readonly createdAt: Date
  readonly items: ReadonlyArray<{
    readonly productId: string
    readonly variantId: string | null
    readonly quantity: number
    readonly price: number
    readonly customizationNote: string | null
  }>
}

export const mapOrderRowToSummary = (row: OrderWithItemsRow): OrderSummary => ({
  id: row.id,
  userId: row.userId,
  customerName: row.customerName,
  customerEmail: row.customerEmail,
  customerAddress: row.customerAddress,
  addressLine1: row.addressLine1,
  addressLine2: row.addressLine2,
  addressLine3: row.addressLine3,
  pinCode: row.pinCode,
  city: row.city,
  state: row.state,
  total: row.totalAmount,
  status: row.status,
  items: row.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId ?? null,
    quantity: item.quantity,
    price: item.price,
    customizationNote: item.customizationNote ?? null,
  })),
  createdAt: row.createdAt.toISOString(),
})

/**
 * Write an order into the Redis mirror.
 *
 * Failures are logged rather than thrown: the historical callers are
 * fire-and-forget and cannot react. Durable callers should use
 * `indexOrderInRedis`, which surfaces the failure so it can be retried.
 */
export const writeOrderToRedis = async (order: OrderSummary): Promise<void> => {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await writeOrderToRedisOrThrow(order)
  } catch (error) {
    logError({
      error,
      context: 'order_redis_write',
      additionalInfo: { orderId: order.id },
    })
  }
}

const writeOrderToRedisOrThrow = async (
  order: OrderSummary
): Promise<boolean> => {
  const redis = getRedisClient()
  if (!redis) return false

  const pipeline = redis.pipeline()
  pipeline.hset(redisOrderKey(order.id), {
    id: order.id,
    userId: order.userId ?? '',
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerAddress: order.customerAddress,
    addressLine1: order.addressLine1 ?? '',
    addressLine2: order.addressLine2 ?? '',
    addressLine3: order.addressLine3 ?? '',
    pinCode: order.pinCode ?? '',
    city: order.city ?? '',
    state: order.state ?? '',
    items: JSON.stringify(order.items),
    total: String(order.total),
    status: order.status,
    createdAt: order.createdAt,
    productNames: order.productNames ?? '',
  })
  if (order.userId) {
    pipeline.sadd(redisUserOrdersKey(order.userId), order.id)
  }
  await pipeline.exec()
  return true
}

/** Outcome of a durable index attempt, returned for scoring and run history. */
export type OrderIndexOutcome = 'indexed' | 'skipped-no-redis' | 'order-missing'

/**
 * Re-read an order and refresh its Redis mirror.
 *
 * The order is re-read rather than taken from the event payload so a retry
 * always mirrors the current row: a status change that lands between the
 * original publish and the retry must not be overwritten with stale data.
 *
 * Unlike `writeOrderToRedis` this propagates Redis failures, which is what
 * lets the calling step retry instead of silently leaving Redis and Postgres
 * out of sync.
 */
export const indexOrderInRedis = async (
  orderId: string
): Promise<OrderIndexOutcome> => {
  const [row] = await db.orders.findManyByIds([orderId])
  if (!row) return 'order-missing'

  const productNames = [
    ...new Set(
      row.items
        .map((item) => (item as { product?: { name?: string } }).product?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ].join(', ')

  const summary = mapOrderRowToSummary(row)
  const written = await writeOrderToRedisOrThrow(
    productNames ? { ...summary, productNames } : summary
  )

  return written ? 'indexed' : 'skipped-no-redis'
}
