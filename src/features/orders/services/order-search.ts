import { drizzleDb } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getCachedData } from '@/lib/redis'
import { orders } from '@/lib/schema'
import {
  searchAllOrdersRedis,
  searchUserOrdersRedis,
} from '@/features/orders/actions/orders'
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { OrderStatus } from '@/lib/types'

const ORDER_SEARCH_LIMIT = 1000
const ORDER_SEARCH_TTL_SECONDS = 60
const ORDER_SEARCH_STALE_SECONDS = 10

interface SearchOrderIdsOptions {
  readonly userId?: string
  readonly status?: OrderStatus
  readonly limit?: number
}

const buildOrderSearchCacheKey = (
  searchTerm: string,
  options: SearchOrderIdsOptions
) => {
  return [
    'search:orders',
    encodeURIComponent(searchTerm.trim().toLowerCase()),
    options.userId ?? 'all-users',
    options.status ?? 'all-statuses',
    String(options.limit ?? ORDER_SEARCH_LIMIT),
  ].join(':')
}

const buildOrderDatabaseSearchCondition = (searchTerm: string) => {
  const pattern = `%${searchTerm}%`

  return or(
    ilike(orders.customerName, pattern),
    ilike(orders.customerEmail, pattern),
    ilike(orders.id, pattern),
    sql`${orders.status}::text ILIKE ${pattern}`,
    sql`EXISTS (
      SELECT 1 FROM "OrderItem" oi
      JOIN "Product" p ON p.id = oi."productId"
      LEFT JOIN "ProductVariant" pv ON pv.id = oi."variantId"
      WHERE oi."orderId" = ${orders.id}
      AND (p.name ILIKE ${pattern} OR pv.sku ILIKE ${pattern})
    )`
  )
}

const searchOrderIdsViaDatabase = async (
  searchTerm: string,
  options: SearchOrderIdsOptions
): Promise<string[]> => {
  const limit = Math.min(
    Math.max(options.limit ?? ORDER_SEARCH_LIMIT, 1),
    ORDER_SEARCH_LIMIT
  )
  const conditions: SQL[] = []
  const searchCondition = buildOrderDatabaseSearchCondition(searchTerm)

  if (searchCondition) {
    conditions.push(searchCondition)
  }

  if (options.userId) {
    conditions.push(eq(orders.userId, options.userId))
  }

  if (options.status) {
    conditions.push(eq(orders.status, options.status))
  }

  const rows = await drizzleDb
    .select({ id: orders.id })
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(limit)

  return rows.map((row) => row.id)
}

export async function searchOrderIds(
  searchTerm: string,
  options: SearchOrderIdsOptions = {}
): Promise<string[] | null> {
  const normalizedSearchTerm = searchTerm.trim()

  if (!normalizedSearchTerm) {
    return []
  }

  const limit = Math.min(
    Math.max(options.limit ?? ORDER_SEARCH_LIMIT, 1),
    ORDER_SEARCH_LIMIT
  )

  try {
    const redisIds = options.userId
      ? await searchUserOrdersRedis(
          options.userId,
          normalizedSearchTerm,
          limit,
          options.status
        )
      : await searchAllOrdersRedis(normalizedSearchTerm, limit, options.status)

    if (redisIds !== null) {
      return redisIds
    }
  } catch (error) {
    logError({
      error,
      context: 'order_search_redis',
      additionalInfo: {
        userId: options.userId,
        status: options.status,
        searchTerm: normalizedSearchTerm,
      },
    })
  }

  try {
    return await getCachedData(
      buildOrderSearchCacheKey(normalizedSearchTerm, { ...options, limit }),
      ORDER_SEARCH_TTL_SECONDS,
      () =>
        searchOrderIdsViaDatabase(normalizedSearchTerm, { ...options, limit }),
      ORDER_SEARCH_STALE_SECONDS
    )
  } catch (error) {
    logError({
      error,
      context: 'order_search_database',
      additionalInfo: {
        userId: options.userId,
        status: options.status,
        searchTerm: normalizedSearchTerm,
      },
    })
    return null
  }
}
