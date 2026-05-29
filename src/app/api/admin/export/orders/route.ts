import { asc } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { streamCsvResponse } from '@/features/admin/services/admin-csv'
import { apiError, handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export const GET = async () => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const rows = await drizzleDb.query.orders.findMany({
      orderBy: [asc(orders.createdAt)],
    })

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
      rows.map((order) => [
        order.id,
        order.customerName,
        order.customerEmail,
        order.totalAmount,
        order.status,
        order.trackingNumber,
        order.shippingProvider,
        order.createdAt.toISOString(),
      ])
    )
  } catch (error) {
    return handleApiError(error)
  }
}
