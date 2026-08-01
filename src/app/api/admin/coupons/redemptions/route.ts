import { db } from '@/lib/db'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { apiError, apiSuccess, handleApiError } from '@/lib/api-utils'
import { serializeRedemptionSummary } from '@/features/admin/services/coupon-admin'

/** Coupon usage / redemption report shown alongside the sales analytics. */
export async function GET() {
  const authCheck = await checkAdminAuth('coupons:manage')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const rows = await db.coupons.redemptionSummary()
    return apiSuccess({ redemptions: rows.map(serializeRedemptionSummary) })
  } catch (error) {
    return handleApiError(error)
  }
}
