import { NextRequest } from 'next/server'
import { z } from 'zod'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { auth } from '@/lib/auth'
import { serializeOrder } from '@/lib/serializers'
import { getCachedData, invalidateCache, getRedisClient } from '@/lib/redis'
import { CACHE_KEYS, CACHE_TTL, invalidateUserOrderCaches } from '@/lib/cache'
import { logError } from '@/lib/logger'
import { waitUntil } from '@vercel/functions'
import { assertOwnership } from '@/lib/ownership'
import { restockOrderItems } from '@/features/orders/services/order-restock'
import {
  isRefundRequestError,
  refundOrder,
} from '@/features/orders/services/refund-service'

export const dynamic = 'force-dynamic'

const OrderActionSchema = z.object({
  action: z.literal('cancel'),
})

/**
 * Orders a customer may still cancel themselves. Once an order has shipped the
 * goods have left the warehouse, so cancellation becomes a support/returns
 * conversation instead.
 */
const CUSTOMER_CANCELLABLE_STATUSES = new Set(['PENDING', 'PROCESSING'])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const { id } = await params

    const order = await getCachedData(
      CACHE_KEYS.ORDER_BY_ID(session.user.id, id),
      CACHE_TTL.ORDER_DETAIL,
      async () => {
        return drizzleDb.query.orders.findFirst({
          where: eq(orders.id, id),
          with: {
            items: {
              with: {
                product: true,
                variant: true,
              },
            },
          },
        })
      },
      CACHE_TTL.ORDER_DETAIL_STALE
    )

    if (!assertOwnership(order, session)) {
      return apiError('Order not found', 404)
    }

    return apiSuccess({ order: serializeOrder(order) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    await parseJsonBody(request, OrderActionSchema)

    const { id } = await params

    const order = await primaryDrizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true },
    })

    if (!assertOwnership(order, session)) {
      return apiError('Order not found', 404)
    }

    if (!CUSTOMER_CANCELLABLE_STATUSES.has(order.status)) {
      return apiError(
        'Orders can only be cancelled before they are shipped',
        400
      )
    }

    // Refund first: if the money cannot be returned the order stays open so the
    // customer can retry, rather than being cancelled without a refund.
    if (order.paymentStatus === 'PAID') {
      try {
        await refundOrder({
          orderId: id,
          reason: 'Cancelled by customer before shipment',
        })
      } catch (refundError) {
        if (isRefundRequestError(refundError)) {
          return apiError(refundError.message, refundError.status)
        }
        throw refundError
      }
    }

    await primaryDrizzleDb.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(eq(orders.id, id))

      await restockOrderItems(tx, order)
    })

    const redis = getRedisClient()
    if (redis) {
      waitUntil(
        redis
          .hset(`order:${id}`, { status: 'CANCELLED' })
          .catch((err) =>
            logError({ error: err, context: 'order_cancel_redis_update' })
          )
      )
    }

    await Promise.allSettled([
      invalidateUserOrderCaches(session.user.id),
      invalidateCache('admin:orders:*'),
      invalidateCache(`admin:order:${id}`),
      invalidateCache(CACHE_KEYS.PRODUCTS_BESTSELLERS_PATTERN),
    ])

    const updatedOrder = await primaryDrizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: {
          with: {
            product: true,
            variant: true,
          },
        },
      },
    })

    if (!updatedOrder) {
      return apiError('Order not found after update', 500)
    }

    return apiSuccess({ order: serializeOrder(updatedOrder) })
  } catch (error) {
    return handleApiError(error)
  }
}
