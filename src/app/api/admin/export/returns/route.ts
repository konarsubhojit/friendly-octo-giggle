import { asc } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { returnRequests } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  batchedCsvRows,
  streamCsvResponse,
} from '@/features/admin/services/admin-csv'
import { apiError, handleApiError } from '@/lib/api-utils'
import { formatMoneyValue } from '@/lib/money'

/**
 * Returns export.
 *
 * Column order is fixed and new columns append to the end, so existing
 * downstream consumers keep working — the same contract the orders export
 * honours.
 */
export const GET = async () => {
  const authCheck = await checkAdminAuth('orders:returns')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    return streamCsvResponse(
      `returns-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'id',
        'orderId',
        'customerEmail',
        'status',
        'reason',
        'decisionReason',
        'itemCount',
        'totalQuantity',
        'refundAmount',
        'refundStatus',
        'createdAt',
        'decidedAt',
        'receivedAt',
      ],
      batchedCsvRows({
        fetchBatch: (offset, limit) =>
          drizzleDb.query.returnRequests.findMany({
            orderBy: [asc(returnRequests.createdAt), asc(returnRequests.id)],
            with: { items: true, order: true, refund: true },
            limit,
            offset,
          }),
        mapRow: (returnRequest) => [
          returnRequest.id,
          returnRequest.orderId,
          returnRequest.order?.customerEmail ?? '',
          returnRequest.status,
          returnRequest.reason,
          returnRequest.decisionReason ?? '',
          String(returnRequest.items.length),
          String(
            returnRequest.items.reduce((sum, item) => sum + item.quantity, 0)
          ),
          formatMoneyValue(returnRequest.refundAmount),
          returnRequest.refund?.status ?? '',
          returnRequest.createdAt.toISOString(),
          returnRequest.decidedAt?.toISOString() ?? '',
          returnRequest.receivedAt?.toISOString() ?? '',
        ],
      })
    )
  } catch (error) {
    return handleApiError(error)
  }
}
