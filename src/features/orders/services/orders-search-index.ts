import { desc } from 'drizzle-orm'
import { s, type Redis } from '@upstash/redis'
import { drizzleDb } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getRedisClient, isRedisAvailable } from '@/lib/redis'
import { orders } from '@/lib/schema'

const ORDERS_INDEX_NAME = 'orders'
const ORDER_KEY_PREFIX = 'order:'
const USER_ORDERS_KEY_PREFIX = 'user:orders:'
const WRITE_BATCH_SIZE = 100

export const ORDER_SEARCH_SCHEMA = s.object({
  id: s.string().noTokenize(),
  customerName: s.string(),
  customerEmail: s.string(),
  customerAddress: s.string(),
  addressLine1: s.string(),
  city: s.string(),
  state: s.string(),
  pinCode: s.string().noTokenize(),
  status: s.keyword(),
  userId: s.string().noTokenize(),
  total: s.string().noTokenize(),
  createdAt: s.string().noTokenize(),
  productNames: s.string(),
})

interface BackfillableOrder {
  readonly id: string
  readonly userId: string | null
  readonly customerName: string
  readonly customerEmail: string
  readonly customerAddress: string
  readonly addressLine1?: string | null
  readonly addressLine2?: string | null
  readonly addressLine3?: string | null
  readonly pinCode?: string | null
  readonly city?: string | null
  readonly state?: string | null
  readonly totalAmount: number
  readonly status: string
  readonly createdAt: Date
  readonly items: ReadonlyArray<{
    readonly productId: string
    readonly variantId: string | null
    readonly quantity: number
    readonly price: number
    readonly customizationNote: string | null
    readonly product: {
      readonly name: string
    }
    readonly variant: {
      readonly sku: string | null
    } | null
  }>
}

const getOrderKey = (orderId: string) => `${ORDER_KEY_PREFIX}${orderId}`
const getUserOrdersKey = (userId: string) =>
  `${USER_ORDERS_KEY_PREFIX}${userId}`

const buildProductNames = (items: BackfillableOrder['items']): string =>
  [...new Set(items.map((item) => item.product.name))].join(', ')

const getOrdersIndex = (redis: Redis) =>
  redis.search.index({
    name: ORDERS_INDEX_NAME,
    schema: ORDER_SEARCH_SCHEMA,
  })

export const areOrdersSearchControlsAvailable = (): boolean =>
  isRedisAvailable()

export async function ensureOrdersSearchIndex(): Promise<{
  indexCreated: boolean
}> {
  const redis = getRedisClient()

  if (!redis) {
    throw new Error('Redis Search is not configured')
  }

  const existing = await getOrdersIndex(redis).describe()

  if (existing) {
    return { indexCreated: false }
  }

  await redis.search.createIndex({
    name: ORDERS_INDEX_NAME,
    dataType: 'hash',
    prefix: ORDER_KEY_PREFIX,
    schema: ORDER_SEARCH_SCHEMA,
  })

  return { indexCreated: true }
}

const fetchOrdersForBackfill = async (): Promise<BackfillableOrder[]> => {
  const rows = await drizzleDb.query.orders.findMany({
    orderBy: [desc(orders.createdAt)],
    with: {
      items: {
        with: {
          product: {
            columns: { name: true },
          },
          variant: {
            columns: { sku: true },
          },
        },
      },
    },
  })

  return rows as BackfillableOrder[]
}

export async function backfillOrdersSearchIndex(): Promise<number> {
  const redis = getRedisClient()

  if (!redis) {
    throw new Error('Redis Search is not configured')
  }

  const rows = await fetchOrdersForBackfill()

  for (let offset = 0; offset < rows.length; offset += WRITE_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + WRITE_BATCH_SIZE)
    const pipeline = redis.pipeline()

    for (const order of batch) {
      pipeline.hset(getOrderKey(order.id), {
        id: order.id,
        userId: order.userId ?? '',
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerAddress: order.customerAddress,
        addressLine1: order.addressLine1 ?? '',
        city: order.city ?? '',
        state: order.state ?? '',
        pinCode: order.pinCode ?? '',
        items: JSON.stringify(
          order.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
            price: item.price,
            customizationNote: item.customizationNote ?? null,
          }))
        ),
        total: String(order.totalAmount),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        productNames: buildProductNames(order.items),
      })

      if (order.userId) {
        pipeline.sadd(getUserOrdersKey(order.userId), order.id)
      }
    }

    await pipeline.exec()
  }

  return rows.length
}

export async function createOrRefreshOrdersSearchIndex(): Promise<{
  indexedOrders: number
  indexCreated: boolean
}> {
  try {
    const { indexCreated } = await ensureOrdersSearchIndex()
    const indexedOrders = await backfillOrdersSearchIndex()

    return {
      indexedOrders,
      indexCreated,
    }
  } catch (error) {
    logError({
      error,
      context: 'orders_search_index',
    })
    throw error
  }
}
