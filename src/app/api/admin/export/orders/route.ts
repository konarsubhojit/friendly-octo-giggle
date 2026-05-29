import { asc } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  batchedCsvRows,
  streamCsvResponse,
} from '@/features/admin/services/admin-csv'
import { apiError, handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export const GET = async () => {
  const authCheck = await checkAdminAuth()
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
        'totalAmount',
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
          order.totalAmount,
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
