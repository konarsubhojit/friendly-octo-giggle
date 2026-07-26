import { auth } from '@/lib/auth'
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { UpdateNotificationPreferencesSchema } from '@/features/account/validations'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/features/account/services/notification-preferences'
import { getVapidPublicKey, isPushConfigured } from '@/lib/notifications/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const preferences = await getNotificationPreferences(session.user.id)
    return apiSuccess({
      preferences,
      pushEnabled: isPushConfigured(),
      vapidPublicKey: getVapidPublicKey(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError('Authentication required', 401)
    }

    const payload = await parseJsonBody(
      request,
      UpdateNotificationPreferencesSchema
    )
    const preferences = await updateNotificationPreferences(
      session.user.id,
      payload
    )
    return apiSuccess({ preferences })
  } catch (error) {
    return handleApiError(error)
  }
}
