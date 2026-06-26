import { drizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import { eq, inArray, desc, count, and, lt, SQL } from 'drizzle-orm'
import { parseOffsetParam } from '@/lib/api-utils'
import { cacheUserOrdersList } from '@/lib/cache'
import { searchOrderIds } from '@/features/orders/services/order-search'

export {
  OrderRequestError,
  isOrderRequestError,
  type OrderSessionUser,
} from './order-service.shared'
export {
  createOrderForUser,
  validateOrderInput,
  priceAndValidateStock,
  persistOrder,
  invalidateOrderRelatedCaches,
  dispatchOrderNotifications,
  type OrderNotificationPublisher,
  type OrderCacheInvalidator,
} from './create-order-service'

const PAGE_SIZE = 20

interface HydratedOrder {
  createdAt: Date | string
  updatedAt: Date | string
  items: Array<{
    product: {
      createdAt: Date | string
      updatedAt: Date | string
    }
  }>
}

const parseOrderLimit = (param: string | null): number =>
  Math.min(
    Math.max(1, Number.parseInt(param ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
    100
  )

const buildOrderConditions = (
  userId: string,
  cursor: string | null,
  useOffset: boolean
): SQL[] => {
  const conditions: SQL[] = [eq(orders.userId, userId)]

  if (!useOffset && cursor) {
    const cursorDate = new Date(cursor)
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(orders.createdAt, cursorDate))
    }
  }

  return conditions
}

const serializeDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value

const serializeOrderList = <
  T extends {
    createdAt: Date | string
    updatedAt: Date | string
    items: Array<{
      product: { createdAt: Date | string; updatedAt: Date | string }
    }>
  },
>(
  rows: T[],
  limit: number
) => {
  const hasMore = rows.length > limit
  const pageItems = hasMore ? rows.slice(0, limit) : rows
  const lastItem = pageItems.at(-1)
  const nextCursor =
    hasMore && lastItem ? serializeDate(lastItem.createdAt) : null

  return {
    orders: pageItems.map((order) => ({
      ...order,
      createdAt: serializeDate(order.createdAt),
      updatedAt: serializeDate(order.updatedAt),
      items: order.items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          createdAt: serializeDate(item.product.createdAt),
          updatedAt: serializeDate(item.product.updatedAt),
        },
      })),
    })),
    nextCursor,
    hasMore,
  }
}

export const getUserOrders = async ({
  requestUrl,
  userId,
}: {
  requestUrl: string
  userId: string
}) => {
  const { searchParams } = new URL(requestUrl)
  const limit = parseOrderLimit(searchParams.get('limit'))
  const search = searchParams.get('search')?.trim() ?? ''
  const cursor = searchParams.get('cursor')
  const offsetParam = searchParams.get('offset')
  const useOffset = offsetParam !== null
  const offset = useOffset ? parseOffsetParam(offsetParam) : 0

  const fetcher = async () => {
    const conditions = buildOrderConditions(userId, cursor, useOffset)
    const countConditions = buildOrderConditions(userId, null, false)
    let totalCountFromSearch: number | null = null

    if (search) {
      const matchedIds = await searchOrderIds(search, {
        userId,
        limit: 1000,
      })

      if (matchedIds?.length === 0) {
        return {
          orders: [],
          nextCursor: null,
          hasMore: false,
          totalCount: 0,
        }
      }

      if (matchedIds && matchedIds.length > 0) {
        const searchIds: string[] = matchedIds
        const searchCondition = inArray(orders.id, searchIds)
        conditions.push(searchCondition)
        totalCountFromSearch = searchIds.length
      }
    }

    const rows = await drizzleDb.query.orders.findMany({
      where: and(...conditions),
      with: { items: { with: { product: true, variant: true } } },
      orderBy: [desc(orders.createdAt)],
      limit: limit + 1,
      offset: useOffset ? offset : undefined,
    })

    const serialized = serializeOrderList(rows as HydratedOrder[], limit)

    return {
      ...serialized,
      totalCount:
        totalCountFromSearch ??
        Number(
          (
            await drizzleDb
              .select({ value: count() })
              .from(orders)
              .where(and(...countConditions))
          )[0]?.value ?? 0
        ),
    }
  }

  return cacheUserOrdersList(fetcher, {
    userId,
    search,
    cursor,
    offset,
    limit,
  })
}
