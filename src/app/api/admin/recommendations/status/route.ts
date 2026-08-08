import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { apiError, apiSuccess, handleApiError } from '@/lib/api-utils'
import { getAffinityStatus } from '@/features/recommendations/services/status'

/** When affinity scores were last refreshed, and how many rows exist. */
export async function GET() {
  try {
    const authCheck = await checkAdminAuth('system:manage')
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status)
    }

    return apiSuccess(await getAffinityStatus())
  } catch (error) {
    return handleApiError(error)
  }
}
