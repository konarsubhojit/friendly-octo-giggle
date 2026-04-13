'use server'

// Architecture note: Order reads and Redis search helpers use server actions
// for direct server-side execution without an HTTP roundtrip. Cart checkout
// uses API routes + Vercel Queue instead (see cart/services/checkout-service.ts)
// because checkout requires durable, retryable processing with idempotency
// guarantees that a queue provides but server actions do not.

import { waitUntil } from '@vercel/functions'
import { drizzleDb } from '@/lib/db'
import { orders, orderItems, products } from '@/lib/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { getRedisClient, invalidateCache } from '@/lib/redis'
import { formatStructuredAddress } from '@/lib/address-utils'
import { generateOrderId } from '@/lib/short-id'
import { logError, logBusinessEvent } from '@/lib/logger'
import { OrderStatusEnum } from '@/features/orders/validations'
import { z } from 'zod'
import { invalidateUserOrderCaches } from '@/lib/cache'
import { ORDER_SEARCH_SCHEMA } from '@/features/orders/services/orders-search-index'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

interface OrderItemRecord {
  productId: string
  variationId?: string | null
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

const OrderItemInputSchema = z.object({
  productId: z.string().min(1),
  variationId: z.string().nullish(),
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

const redisOrderKey = (orderId: string) => `order:${orderId}`
const redisUserOrdersKey = (userId: string) => `user:orders:${userId}`

export const writeOrderToRedis = async (order: OrderSummary): Promise<void> => {
  const redis = getRedisClient()
  if (!redis) return

  try {
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
  } catch (error) {
    logError({
      error,
      context: 'order_redis_write',
      additionalInfo: { orderId: order.id },
    })
  }
}

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
    readonly variationId: string | null
    readonly quantity: number
    readonly price: number
    readonly customizationNote: string | null
  }>
}

const mapOrderRowToSummary = (row: OrderWithItemsRow): OrderSummary => ({
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
    variationId: item.variationId ?? null,
    quantity: item.quantity,
    price: item.price,
    customizationNote: item.customizationNote ?? null,
  })),
  createdAt: row.createdAt.toISOString(),
})

const fetchOrdersFromDb = async (userId: string): Promise<OrderSummary[]> => {
  const rows = await drizzleDb.query.orders.findMany({
    where: eq(orders.userId, userId),
    orderBy: [desc(orders.createdAt)],
    with: { items: true },
  })

  return rows.map(mapOrderRowToSummary)
}

const fetchOrdersByIdsFromDb = async (
  orderIds: string[]
): Promise<OrderSummary[]> => {
  if (orderIds.length === 0) {
    return []
  }

  const rows = await drizzleDb.query.orders.findMany({
    where: (orderTable, { inArray: inArrayOperator }) =>
      inArrayOperator(orderTable.id, orderIds),
    with: { items: true },
  })

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

  return pipeline.exec<(Record<string, unknown> | null)[]>()
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

const insertOrderRecords = async (
  userId: string,
  orderId: string,
  input: CreateOrderActionInput,
  total: number
) => {
  await drizzleDb.transaction(async (tx) => {
    await tx.insert(orders).values({
      id: orderId,
      userId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerAddress: input.customerAddress || formatStructuredAddress({
        customerAddress: '',
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        addressLine3: input.addressLine3,
        pinCode: input.pinCode,
        city: input.city,
        state: input.state,
      }),
      addressLine1: input.addressLine1 || null,
      addressLine2: input.addressLine2 || null,
      addressLine3: input.addressLine3 || null,
      pinCode: input.pinCode || null,
      city: input.city || null,
      state: input.state || null,
      totalAmount: total,
      status: 'PENDING',
      updatedAt: new Date(),
    })

    await tx.insert(orderItems).values(
      input.items.map((item) => ({
        orderId,
        productId: item.productId,
        variationId: item.variationId ?? null,
        quantity: item.quantity,
        price: item.price,
        customizationNote: item.customizationNote ?? null,
      }))
    )
  })
}

const buildProductNamesString = async (
  items: CreateOrderActionInput['items']
): Promise<string> => {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const productRows = await drizzleDb.query.products.findMany({
    where: inArray(products.id, productIds),
    columns: { id: true, name: true },
    with: { variations: { columns: { id: true, name: true } } },
  })

  const productNameMap = new Map(
    productRows.map((product) => [product.id, product.name])
  )
  const variationNameMap = new Map(
    productRows.flatMap((product) =>
      product.variations.map((variation) => [variation.id, variation.name])
    )
  )

  return [
    ...new Set(
      items.map((item) => {
        const productName = productNameMap.get(item.productId) ?? ''
        const variationName = item.variationId
          ? variationNameMap.get(item.variationId)
          : undefined

        return variationName ? `${productName} - ${variationName}` : productName
      })
    ),
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
  customerAddress: input.customerAddress || formatStructuredAddress({
    customerAddress: '',
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    addressLine3: input.addressLine3,
    pinCode: input.pinCode,
    city: input.city,
    state: input.state,
  }),
  addressLine1: input.addressLine1 || null,
  addressLine2: input.addressLine2 || null,
  addressLine3: input.addressLine3 || null,
  pinCode: input.pinCode || null,
  city: input.city || null,
  state: input.state || null,
  total,
  status: 'PENDING',
  items: input.items,
  createdAt,
  productNames,
})

const invalidateOrderCaches = (
  userId: string,
  items: CreateOrderActionInput['items']
) =>
  Promise.all([
    invalidateCache('products:*'),
    invalidateCache('admin:orders:*'),
    invalidateUserOrderCaches(userId),
    ...items.map((item) => invalidateCache(`product:${item.productId}`)),
  ])

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
    const updated = await drizzleDb
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning({ id: orders.id })

    if (updated.length === 0) {
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
  const redis = getRedisClient()
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

    return results.map((result) => {
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
