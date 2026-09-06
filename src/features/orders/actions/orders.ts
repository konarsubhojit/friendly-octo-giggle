'use server'

// Architecture note: Order reads and Redis search helpers use server actions
// for direct server-side execution without an HTTP roundtrip. Cart checkout
// uses API routes + Vercel Queue instead (see cart/services/checkout-service.ts)
// because checkout requires durable, retryable processing with idempotency
// guarantees that a queue provides but server actions do not.

import { waitUntil } from '@vercel/functions'
import { db } from '@/lib/db'
import { getRedisClient, invalidateCache } from '@/lib/redis'
import { getSearchRedisClient } from '@/lib/search/redis'
import { formatStructuredAddress } from '@/lib/address-utils'
import { generateOrderId } from '@/lib/short-id'
import { logError, logBusinessEvent } from '@/lib/logger'
import { OrderStatusEnum } from '@/features/orders/validations'
import { z } from 'zod'
import { invalidateUserOrderCaches } from '@/lib/cache'
import { ORDER_SEARCH_SCHEMA } from '@/features/orders/services/orders-search-index'
import {
  mapOrderRowToSummary,
  redisOrderKey,
  redisUserOrdersKey,
  writeOrderToRedis as writeOrderToRedisMirror,
  type OrderItemRecord,
  type OrderSummary,
} from '@/features/orders/services/order-mirror'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

const OrderItemInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  customizationNote: z.string().max(500).nullish(),
})

const CreateOrderActionSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerEmail: z.email({ message: 'Invalid email address' }),
  customerAddress: z.string().max(500).optional().default(''),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().default(''),
  addressLine3: z.string().trim().max(200).optional().default(''),
  pinCode: z.string().regex(/^\d{6}$/),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  items: z.array(OrderItemInputSchema).min(1),
})

type CreateOrderActionInput = z.infer<typeof CreateOrderActionSchema>

/**
 * Re-exported so existing callers (and their test doubles) keep importing the
 * mirror from this module while the implementation lives in the service layer.
 */
export const writeOrderToRedis = async (order: OrderSummary): Promise<void> =>
  writeOrderToRedisMirror(order)

const parseRedisHash = (hash: Record<string, unknown>): OrderSummary | null => {
  if (!hash.id || typeof hash.id !== 'string') return null
  return {
    id: hash.id,
    userId: (hash.userId as string) || null,
    customerName: (hash.customerName as string) ?? '',
    customerEmail: (hash.customerEmail as string) ?? '',
    customerAddress: (hash.customerAddress as string) ?? '',
    addressLine1: (hash.addressLine1 as string) || null,
    addressLine2: (hash.addressLine2 as string) || null,
    addressLine3: (hash.addressLine3 as string) || null,
    pinCode: (hash.pinCode as string) || null,
    city: (hash.city as string) || null,
    state: (hash.state as string) || null,
    total: Number(hash.total ?? 0),
    status: (hash.status as string) ?? 'PENDING',
    items: JSON.parse((hash.items as string) ?? '[]') as OrderItemRecord[],
    createdAt: (hash.createdAt as string) ?? '',
  }
}

const fetchOrdersFromDb = async (userId: string): Promise<OrderSummary[]> => {
  const rows = await db.orders.findManyByUserId(userId)
  return rows.map(mapOrderRowToSummary)
}

const fetchOrdersByIdsFromDb = async (
  orderIds: string[]
): Promise<OrderSummary[]> => {
  if (orderIds.length === 0) {
    return []
  }

  const rows = await db.orders.findManyByIds(orderIds)
  return rows.map(mapOrderRowToSummary)
}

const fetchRedisOrderHashes = async (
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  orderIds: string[]
): Promise<(Record<string, unknown> | null)[]> => {
  const pipeline = redis.pipeline()
  for (const orderId of orderIds) {
    pipeline.hgetall(redisOrderKey(orderId))
  }

  return pipeline.exec() as Promise<(Record<string, unknown> | null)[]>
}

const splitRedisOrders = (
  orderIds: string[],
  hashes: (Record<string, unknown> | null)[]
): {
  validOrders: OrderSummary[]
  missingIds: string[]
} => {
  const validOrders: OrderSummary[] = []
  const missingIds: string[] = []

  hashes.forEach((hash, index) => {
    const parsed = hash ? parseRedisHash(hash) : null
    if (parsed) {
      validOrders.push(parsed)
      return
    }

    missingIds.push(orderIds[index])
  })

  return { validOrders, missingIds }
}

const hydrateMissingRedisOrders = async (
  userId: string,
  missingIds: string[]
): Promise<OrderSummary[]> => {
  if (missingIds.length === 0) {
    return []
  }

  try {
    const dbOrders = await fetchOrdersByIdsFromDb(missingIds)
    for (const order of dbOrders) {
      waitUntil(writeOrderToRedis(order))
    }
    return dbOrders
  } catch (error) {
    logError({
      error,
      context: 'get_orders_redis_orphan_pg_fallback',
      additionalInfo: { userId },
    })
    return []
  }
}

const getUserOrdersFromRedis = async (
  userId: string,
  redis: NonNullable<ReturnType<typeof getRedisClient>>
): Promise<OrderSummary[] | null> => {
  try {
    const orderIds = await redis.smembers(redisUserOrdersKey(userId))
    if (orderIds.length === 0) {
      return []
    }

    const results = await fetchRedisOrderHashes(redis, orderIds)
    const { validOrders, missingIds } = splitRedisOrders(orderIds, results)
    const hydratedOrders = await hydrateMissingRedisOrders(userId, missingIds)

    return [...validOrders, ...hydratedOrders]
  } catch (error) {
    logError({
      error,
      context: 'get_orders_redis',
      additionalInfo: { userId },
    })
    return null
  }
}

const calculateOrderTotal = (items: CreateOrderActionInput['items']) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0)

const resolveOrderAddress = (input: CreateOrderActionInput) => {
  const customerAddress =
    input.customerAddress ||
    formatStructuredAddress({
      customerAddress: '',
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      addressLine3: input.addressLine3,
      pinCode: input.pinCode,
      city: input.city,
      state: input.state,
    })

  return {
    customerAddress,
    addressLine1: input.addressLine1 || null,
    addressLine2: input.addressLine2 || null,
    addressLine3: input.addressLine3 || null,
    pinCode: input.pinCode || null,
    city: input.city || null,
    state: input.state || null,
  }
}

const insertOrderRecords = async (
  userId: string,
  orderId: string,
  input: CreateOrderActionInput,
  total: number
) => {
  const address = resolveOrderAddress(input)

  await db.orders.insertWithItems({
    orderId,
    userId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    ...address,
    totalAmount: total,
    items: input.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price: item.price,
      customizationNote: item.customizationNote ?? null,
    })),
  })
}

const buildProductNamesString = async (
  items: CreateOrderActionInput['items']
): Promise<string> => {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const productRows = await db.products.findNamesByIds(productIds)

  const productNameMap = new Map(
    productRows.map((product) => [product.id, product.name])
  )

  return [
    ...new Set(items.map((item) => productNameMap.get(item.productId) ?? '')),
  ].join(', ')
}

const buildOrderSummary = ({
  orderId,
  userId,
  input,
  total,
  createdAt,
  productNames,
}: {
  orderId: string
  userId: string
  input: CreateOrderActionInput
  total: number
  createdAt: string
  productNames: string
}): OrderSummary => ({
  id: orderId,
  userId,
  customerName: input.customerName,
  customerEmail: input.customerEmail,
  ...resolveOrderAddress(input),
  total,
  status: 'PENDING',
  items: input.items,
  createdAt,
  productNames,
})

const invalidateOrderCaches = (
  userId: string,
  items: CreateOrderActionInput['items']
) => {
  const productIds = [...new Set(items.map((item) => item.productId))]

  return Promise.all([
    invalidateCache('admin:orders:*'),
    invalidateUserOrderCaches(userId),
    ...productIds.map((productId) => invalidateCache(`product:${productId}`)),
  ])
}

export const createOrder = async (
  userId: string,
  orderData: CreateOrderActionInput
): Promise<ActionResult<{ orderId: string }>> => {
  const parseResult = CreateOrderActionSchema.safeParse(orderData)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message ?? 'Invalid order data',
    }
  }

  const validated = parseResult.data
  const total = calculateOrderTotal(validated.items)
  const orderId = generateOrderId()
  const createdAt = new Date().toISOString()

  try {
    await insertOrderRecords(userId, orderId, validated, total)
  } catch (error) {
    logError({
      error,
      context: 'create_order_pg',
      additionalInfo: { userId },
    })
    return { success: false, error: 'Failed to create order' }
  }

  const productNamesStr = await buildProductNamesString(validated.items)
  const orderSummary = buildOrderSummary({
    orderId,
    userId,
    input: validated,
    total,
    createdAt,
    productNames: productNamesStr,
  })

  waitUntil(writeOrderToRedis(orderSummary))

  logBusinessEvent({
    event: 'order_created',
    details: { orderId, userId, total },
    success: true,
  })

  waitUntil(invalidateOrderCaches(userId, validated.items))

  return { success: true, data: { orderId } }
}

export const updateOrderStatus = async (
  orderId: string,
  newStatus: string
): Promise<ActionResult<{ orderId: string }>> => {
  const parseResult = OrderStatusEnum.safeParse(newStatus)
  if (!parseResult.success) {
    return { success: false, error: 'Invalid order status' }
  }

  const status = parseResult.data

  try {
    const updated = await db.orders.updateStatus(orderId, status)

    if (!updated) {
      return { success: false, error: 'Order not found' }
    }
  } catch (error) {
    logError({
      error,
      context: 'update_order_status_pg',
      additionalInfo: { orderId, status },
    })
    return { success: false, error: 'Failed to update order status' }
  }

  const redis = getRedisClient()
  if (redis) {
    try {
      await redis.hset(redisOrderKey(orderId), { status })
    } catch (error) {
      logError({
        error,
        context: 'update_order_status_redis',
        additionalInfo: { orderId, status },
      })
    }
  }

  logBusinessEvent({
    event: 'order_status_updated',
    details: { orderId, status },
    success: true,
  })

  return { success: true, data: { orderId } }
}

export const getUserOrders = async (
  userId: string
): Promise<ActionResult<OrderSummary[]>> => {
  const redis = getRedisClient()

  if (redis) {
    const redisOrders = await getUserOrdersFromRedis(userId, redis)
    if (redisOrders) {
      return { success: true, data: redisOrders }
    }
  }

  try {
    const data = await fetchOrdersFromDb(userId)
    return { success: true, data }
  } catch (error) {
    logError({
      error,
      context: 'get_orders_pg',
      additionalInfo: { userId },
    })
    return { success: false, error: 'Failed to retrieve orders' }
  }
}

const searchOrdersViaIndex = async (
  searchTerm: string,
  limit: number,
  userId?: string,
  status?: string
): Promise<string[] | null> => {
  const redis = getSearchRedisClient()
  if (!redis) return null

  try {
    const index = redis.search.index({
      name: 'orders',
      schema: ORDER_SEARCH_SCHEMA,
    })

    const baseFilter = {
      ...(userId ? { userId } : {}),
      ...(status ? { status } : {}),
    }

    const results = await index.query({
      filter: {
        $should: [
          { customerName: searchTerm, ...baseFilter },
          { customerEmail: searchTerm, ...baseFilter },
          { customerAddress: searchTerm, ...baseFilter },
          { id: searchTerm, ...baseFilter },
          { status: searchTerm, ...baseFilter },
          { productNames: searchTerm, ...baseFilter },
        ],
      },
      select: {},
      limit,
    })

    return results.map((result: { key: unknown }) => {
      const key = String(result.key)
      return key.startsWith('order:') ? key.slice(6) : key
    })
  } catch (error) {
    logError({
      error,
      context: 'search_orders_redis_ft',
      additionalInfo: { searchTerm, userId, status },
    })
    return null
  }
}

export const searchUserOrdersRedis = async (
  userId: string,
  searchTerm: string,
  limit: number = 100,
  status?: string
): Promise<string[] | null> =>
  searchOrdersViaIndex(searchTerm, limit, userId, status)

export const searchAllOrdersRedis = async (
  searchTerm: string,
  limit: number = 100,
  status?: string
): Promise<string[] | null> =>
  searchOrdersViaIndex(searchTerm, limit, undefined, status)
