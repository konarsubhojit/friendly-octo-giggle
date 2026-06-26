import { db } from '@/lib/db'
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
    let searchIds: string[] | undefined
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
        searchIds = matchedIds
        totalCountFromSearch = searchIds.length
      }
    }

    const rows = await db.orders.findMany({
      userId,
      cursor,
      useOffset,
      searchIds,
      limit: limit + 1,
      offset: useOffset ? offset : undefined,
    })

    const serialized = serializeOrderList(rows as HydratedOrder[], limit)

    return {
      ...serialized,
      totalCount: totalCountFromSearch ?? (await db.orders.count(userId)),
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
