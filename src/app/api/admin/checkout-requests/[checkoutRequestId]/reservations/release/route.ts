import { NextRequest } from 'next/server'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { releaseForCheckoutRequest } from '@/features/orders/services/stock-reservation'
import { ReleaseReservationSchema } from '@/features/orders/validations'
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { recordStockReservationMetric } from '@/lib/metrics'

/**
 * Return an operator-selected hold to available stock.
 *
 * The release itself is the same claim-shaped transition the automatic paths
 * use, so pressing the button twice returns the units once.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutRequestId: string }> }
) {
  const authCheck = await checkAdminAuth('orders:update')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { checkoutRequestId } = await params
    const { reason } = await parseJsonBody(request, ReleaseReservationSchema)

    const settlement = await releaseForCheckoutRequest({
      checkoutRequestId,
      reason: `admin:${reason}`,
    })

    if (settlement.reservations > 0) {
      recordStockReservationMetric('manually_released', settlement.reservations)
    }

    await recordAdminAuditLog({
      userId: authCheck.userId,
      role: authCheck.role,
      entity: 'StockReservation',
      entityId: checkoutRequestId,
      action: 'release',
      diff: { reason, ...settlement },
    })

    return apiSuccess(settlement)
  } catch (error) {
    return handleApiError(error)
  }
}
