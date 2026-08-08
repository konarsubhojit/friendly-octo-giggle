import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { serializeOrder } from '@/lib/serializers'
import { RefundOrderSchema } from '@/features/orders/validations'
import {
  isRefundRequestError,
  refundOrder,
} from '@/features/orders/services/refund-service'

/**
 * Refund an order in full or in part.
 *
 * Refunds move money, so they require the dedicated `orders:refund` permission
 * rather than the broader `orders:update` used for fulfilment.
 */
export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const authCheck = await checkAdminAuth('orders:refund')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id } = await params
    const body = await parseJsonBody(request, RefundOrderSchema, {
      allowEmpty: true,
    })

    const result = await refundOrder({
      orderId: id,
      amount: body?.amount,
      reason: body?.reason ?? null,
      actor: { userId: authCheck.userId, role: authCheck.role },
    })

    const order = await primaryDrizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: { with: { product: true, variant: true } } },
    })

    if (!order) {
      return apiError('Order not found', 404)
    }

    return apiSuccess({
      order: serializeOrder(order),
      refund: result.refund,
      refundedTotal: result.refundedTotal,
      refundableBalance: result.refundableBalance,
      restocked: result.restocked,
    })
  } catch (error) {
    if (isRefundRequestError(error)) {
      return apiError(error.message, error.status)
    }
    return handleApiError(error)
  }
}
