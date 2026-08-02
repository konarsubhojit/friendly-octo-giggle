import { asc } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  batchedCsvRows,
  streamCsvResponse,
} from '@/features/admin/services/admin-csv'
import { apiError, handleApiError } from '@/lib/api-utils'
import { formatMoneyValue } from '@/lib/money'

export const GET = async () => {
  const authCheck = await checkAdminAuth('orders:read')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    return streamCsvResponse(
      'orders.csv',
      [
        'id',
        'customerName',
        'customerEmail',
        'subtotalAmount',
        'shippingAmount',
        'taxAmount',
        'shippingMethod',
        'totalAmount',
        'discountAmount',
        'couponCode',
        'status',
        'trackingNumber',
        'shippingProvider',
        'createdAt',
      ],
      batchedCsvRows({
        fetchBatch: (offset, limit) =>
          drizzleDb.query.orders.findMany({
            orderBy: [asc(orders.createdAt), asc(orders.id)],
            limit,
            offset,
          }),
        mapRow: (order) => [
          order.id,
          order.customerName,
          order.customerEmail,
          formatMoneyValue(order.subtotalAmount),
          formatMoneyValue(order.shippingAmount),
          formatMoneyValue(order.taxAmount),
          order.shippingMethod,
          formatMoneyValue(order.totalAmount),
          formatMoneyValue(order.discountAmount ?? 0),
          order.couponCode ?? '',
          order.status,
          order.trackingNumber,
          order.shippingProvider,
          order.createdAt.toISOString(),
        ],
      })
    )
  } catch (error) {
    return handleApiError(error)
  }
}
