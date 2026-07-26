import webpush from 'web-push'
import { env } from '@/lib/env'
import { logError, logger } from '@/lib/logger'
import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptions,
} from '@/features/account/services/push-subscription-service'

/** Payload delivered to the service worker's `push` handler. */
export interface PushNotificationPayload {
  readonly title: string
  readonly body: string
  /** Relative in-app path opened when the notification is clicked. */
  readonly url?: string
  /** Collapse key so repeated updates for one order replace each other. */
  readonly tag?: string
}

/** Status codes push services return for a permanently gone subscription. */
const GONE_STATUS_CODES = new Set([404, 410])

const DEFAULT_VAPID_SUBJECT = 'mailto:support@example.com'

let configured = false

/** True when VAPID keys are present, i.e. web push can be delivered. */
export const isPushConfigured = (): boolean =>
  Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)

/** Public VAPID key clients need to create a subscription. */
export const getVapidPublicKey = (): string | null =>
  env.VAPID_PUBLIC_KEY ?? null

const configure = (): void => {
  if (configured || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return
  webpush.setVapidDetails(
    env.VAPID_SUBJECT ?? DEFAULT_VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  )
  configured = true
}

const getStatusCode = (error: unknown): number | undefined => {
  const candidate = error as { statusCode?: number } | null
  return typeof candidate?.statusCode === 'number'
    ? candidate.statusCode
    : undefined
}

/**
 * Sends a payload to every subscription owned by the user.
 *
 * Subscriptions the push service reports as expired or revoked (404/410) are
 * removed so the lifecycle stays clean. Returns the number of successful sends.
 * Never throws: push is best-effort and must not fail the caller's flow.
 */
export const sendPushToUser = async (
  userId: string,
  payload: PushNotificationPayload
): Promise<number> => {
  if (!isPushConfigured()) return 0
  configure()

  const subscriptions = await listPushSubscriptions(userId)
  if (subscriptions.length === 0) return 0

  const body = JSON.stringify(payload)

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body
        )
        return true
      } catch (error) {
        const statusCode = getStatusCode(error)
        if (statusCode !== undefined && GONE_STATUS_CODES.has(statusCode)) {
          await deletePushSubscriptionByEndpoint(subscription.endpoint)
          logger.info(
            { userId, statusCode },
            'push_subscription_expired_removed'
          )
          return false
        }
        logError({
          error,
          context: 'push_send_failed',
          additionalInfo: { userId, statusCode },
        })
        return false
      }
    })
  )

  return results.filter(Boolean).length
}
