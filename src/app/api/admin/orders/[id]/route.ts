import { NextRequest } from 'next/server'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { cacheAdminOrderById, invalidateAdminOrderCaches } from '@/lib/cache'
import { serializeOrder } from '@/lib/serializers'
import { UpdateOrderStatusSchema } from '@/features/orders/validations'
import { notifyOrderStatusUpdate } from '@/lib/notifications/order-notifications'
import { orderStatusChanged } from '@/features/orders/inngest/events'
import { dispatchWorkflowEvent } from '@/lib/inngest/dispatch'
import { orderSession } from '@/lib/inngest/sessions'
import { logBusinessEvent, logError } from '@/lib/logger'
import { getRedisClient } from '@/lib/redis'
import { settlesPaymentOnDelivery } from '@/lib/payments'
import { restockOrderItems } from '@/features/orders/services/order-restock'
import { VALID_ORDER_TRANSITIONS } from '@/features/orders/services/order-status-transitions'
import { waitUntil } from '@vercel/functions'

/**
 * Settle providers that collect payment at delivery (e.g. Cash on Delivery).
 * Confirming delivery is the settlement event for those orders.
 */
const buildDeliverySettlement = (
  nextStatus: string,
  currentOrder?: {
    paymentProvider: string | null
    paymentStatus: string
    totalAmount: number
  }
) => {
  if (
    nextStatus !== 'DELIVERED' ||
    !currentOrder ||
    currentOrder.paymentStatus === 'PAID' ||
    !settlesPaymentOnDelivery(currentOrder.paymentProvider)
  ) {
    return {}
  }

  return {
    paymentStatus: 'PAID' as const,
    amountPaid: currentOrder.totalAmount,
    paidAt: new Date(),
  }
}

const buildUpdateData = (
  data: {
    status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
    trackingNumber?: string | null
    shippingProvider?: string | null
  },
  currentOrder?: {
    status?: string
    paymentProvider: string | null
    paymentStatus: string
    totalAmount: number
  }
) => {
  const optional = Object.fromEntries(
    Object.entries({
      trackingNumber: data.trackingNumber,
      shippingProvider: data.shippingProvider,
    }).filter(([, v]) => v !== undefined)
  )
  // Stamped on the transition *into* DELIVERED, not on every write that leaves
  // the order delivered. `DELIVERED -> DELIVERED` is a legal transition (an
  // admin editing tracking details, say), and re-stamping would silently
  // restart the customer's return window. The return window is measured from
  // this column; `updatedAt` cannot stand in for it because any later mutation
  // moves it.
  const isNewlyDelivered =
    data.status === 'DELIVERED' && currentOrder?.status !== 'DELIVERED'

  return {
    status: data.status,
    updatedAt: new Date(),
    ...(isNewlyDelivered ? { deliveredAt: new Date() } : {}),
    ...optional,
    ...buildDeliverySettlement(data.status, currentOrder),
  }
}

const NOTIFY_STATUSES = new Set([
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
])

const dispatchStatusNotification = async (
  order: {
    id: string
    userId: string | null
    customerEmail: string
    customerName: string
    trackingNumber: string | null
    shippingProvider: string | null
  },
  update: {
    status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
    trackingNumber?: string | null
    shippingProvider?: string | null
  }
) => {
  const trackingNumber = update.trackingNumber ?? order.trackingNumber ?? null
  const shippingProvider =
    update.shippingProvider ?? order.shippingProvider ?? null

  const dispatchResult = await dispatchWorkflowEvent({
    event: orderStatusChanged.create(
      {
        orderId: order.id,
        userId: order.userId,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        newStatus: update.status,
        trackingNumber,
        shippingProvider,
      },
      // Keeps every status change for this order — created, shipped,
      // delivered, days apart — in one session.
      { meta: { sessions: orderSession(order.id) } }
    ),
    context: 'order_status_changed_publish_failed',
    details: { orderId: order.id, newStatus: update.status },
    fallback: () =>
      notifyOrderStatusUpdate({
        to: order.customerEmail,
        customerName: order.customerName,
        orderId: order.id,
        status: update.status,
        trackingNumber,
        shippingProvider,
      }),
  })

  logBusinessEvent({
    event: 'order_status_email_queued',
    details: {
      orderId: order.id,
      newStatus: update.status,
      dispatch: dispatchResult,
    },
    success: true,
  })
}

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const authCheck = await checkAdminAuth('orders:update')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id } = await params
    const validatedBody = await parseJsonBody(request, UpdateOrderStatusSchema)

    const currentOrder = await primaryDrizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true },
    })

    if (!currentOrder) {
      return apiError('Order not found', 404)
    }

    const allowedNext = VALID_ORDER_TRANSITIONS[currentOrder.status] ?? []
    if (!allowedNext.includes(validatedBody.status)) {
      return apiError(
        `Cannot transition order from ${currentOrder.status} to ${validatedBody.status}`,
        400
      )
    }

    if (
      validatedBody.status === 'CANCELLED' &&
      currentOrder.status !== 'CANCELLED'
    ) {
      await primaryDrizzleDb.transaction(async (tx) => {
        await tx
          .update(orders)
          .set(buildUpdateData(validatedBody, currentOrder))
          .where(eq(orders.id, id))

        await restockOrderItems(tx, currentOrder)
      })
    } else {
      await primaryDrizzleDb
        .update(orders)
        .set(buildUpdateData(validatedBody, currentOrder))
        .where(eq(orders.id, id))
    }

    const order = await primaryDrizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: { with: { product: true, variant: true } } },
    })

    if (!order) {
      return apiError('Order not found', 404)
    }

    await invalidateAdminOrderCaches(id, order.userId)

    const redis = getRedisClient()
    if (redis) {
      waitUntil(
        redis
          .hset(`order:${id}`, { status: validatedBody.status })
          .catch((err) =>
            logError({ error: err, context: 'admin_order_redis_update' })
          )
      )
    }

    if (NOTIFY_STATUSES.has(validatedBody.status)) {
      await dispatchStatusNotification(order, validatedBody)
    }

    return apiSuccess({ order: serializeOrder(order) })
  } catch (error) {
    return handleApiError(error)
  }
}

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const authCheck = await checkAdminAuth('orders:read')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unknown error', authCheck.status)
  }

  try {
    const { id } = await params

    const order = await cacheAdminOrderById(id, () =>
      drizzleDb.query.orders.findFirst({
        where: eq(orders.id, id),
        with: { items: { with: { product: true, variant: true } } },
      })
    )

    if (!order) {
      return apiError('Order not found', 404)
    }

    return apiSuccess({
      order: serializeOrder(order),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
