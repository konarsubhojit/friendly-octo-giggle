import { NextRequest } from 'next/server'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { apiError, apiSuccess, handleApiError } from '@/lib/api-utils'
import { dispatchWorkflowEvent } from '@/lib/inngest/dispatch'
import { invalidateCache } from '@/lib/redis'
import { CACHE_KEYS } from '@/lib/cache'
import { AFFINITY_RECOMPUTE_EVENT } from '@/features/recommendations/inngest/affinity'
import { RecomputeRequestSchema } from '@/features/recommendations/validations'

/**
 * Trigger an out-of-schedule scoring run.
 *
 * Publishes the same event the nightly cron trigger fires, so the manual path
 * and the scheduled path cannot drift apart. Returns as soon as the event is
 * accepted; the function's `concurrency: 1` serialises a second trigger fired
 * while a run is already in flight.
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await checkAdminAuth('system:manage')
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status)
    }

    const body = await request.json().catch(() => ({}))
    const parsed = RecomputeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('windowDays must be between 7 and 365', 400)
    }

    const dispatch = await dispatchWorkflowEvent({
      event: {
        name: AFFINITY_RECOMPUTE_EVENT,
        data: {
          windowDays: parsed.data.windowDays,
          triggeredBy: authCheck.userId,
        },
      },
      context: 'admin_affinity_recompute',
    })

    // The status figures are about to change; drop the cached snapshot so the
    // admin sees the new timestamp rather than a minute-old one.
    await invalidateCache(CACHE_KEYS.RECOMMENDATIONS_STATUS)

    return apiSuccess({ accepted: dispatch !== 'dropped', dispatch }, 202)
  } catch (error) {
    return handleApiError(error)
  }
}
