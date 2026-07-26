import { and, eq } from 'drizzle-orm'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import { pushSubscriptions } from '@/lib/schema'
import type { PushSubscriptionInput } from '@/features/account/validations'

export interface StoredPushSubscription {
  readonly id: string
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
}

const toStored = (
  row: typeof pushSubscriptions.$inferSelect
): StoredPushSubscription => ({
  id: row.id,
  endpoint: row.endpoint,
  p256dh: row.p256dh,
  auth: row.auth,
})

/** Lists every active push subscription owned by a user. */
export const listPushSubscriptions = async (
  userId: string
): Promise<StoredPushSubscription[]> =>
  drizzleDb.query.pushSubscriptions
    .findMany({ where: eq(pushSubscriptions.userId, userId) })
    .then((rows) => rows.map(toStored))

/**
 * Stores a browser subscription, replacing the keys when the same endpoint is
 * re-registered (browsers rotate keys after a `pushsubscriptionchange`).
 * The endpoint is re-assigned to the current user so a shared device does not
 * leak notifications to the previous owner.
 */
export const savePushSubscription = async (
  userId: string,
  input: PushSubscriptionInput,
  userAgent?: string | null
): Promise<void> => {
  await primaryDrizzleDb
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent ?? null,
        updatedAt: new Date(),
      },
    })
}

/** Removes a subscription the user revoked. Scoped to the owner. */
export const deletePushSubscription = async (
  userId: string,
  endpoint: string
): Promise<void> => {
  await primaryDrizzleDb
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    )
}

/** Removes an expired/gone subscription regardless of owner. */
export const deletePushSubscriptionByEndpoint = async (
  endpoint: string
): Promise<void> => {
  await primaryDrizzleDb
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
}
