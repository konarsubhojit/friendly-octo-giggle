import { auth } from '@/lib/auth'
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import {
  DeletePushSubscriptionSchema,
  PushSubscriptionSchema,
} from '@/features/account/validations'
import {
  deletePushSubscription,
  savePushSubscription,
} from '@/features/account/services/push-subscription-service'

export const dynamic = 'force-dynamic'

/** Registers (or refreshes) the caller's browser push subscription. */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const payload = await parseJsonBody(request, PushSubscriptionSchema)
    await savePushSubscription(
      session.user.id,
      payload,
      request.headers.get('user-agent')
    )
    return apiSuccess({ subscribed: true }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Removes a revoked or expired subscription owned by the caller. */
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const payload = await parseJsonBody(request, DeletePushSubscriptionSchema)
    await deletePushSubscription(session.user.id, payload.endpoint)
    return apiSuccess({ subscribed: false })
  } catch (error) {
    return handleApiError(error)
  }
}
