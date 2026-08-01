import { eq } from 'drizzle-orm'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import { notificationPreferences, users } from '@/lib/schema'
import type { UpdateNotificationPreferencesInput } from '@/features/account/validations'

/** Delivery channels a notification can be routed through. */
export const NOTIFICATION_CHANNELS = ['email', 'push', 'sms'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

/**
 * Notification categories.
 * - `transactional`: order lifecycle updates the customer explicitly asked for.
 * - `marketing`: promotions, abandoned-cart nudges and other opt-in messaging.
 */
export const NOTIFICATION_CATEGORIES = ['transactional', 'marketing'] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export interface NotificationPreferences {
  readonly transactionalEmail: boolean
  readonly transactionalPush: boolean
  readonly transactionalSms: boolean
  readonly marketingEmail: boolean
  readonly marketingPush: boolean
  readonly marketingSms: boolean
}

/**
 * Defaults applied when a user has never saved preferences.
 * Transactional email is on (customers expect order receipts); every other
 * channel is opt-in, which also keeps marketing consent explicit.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  transactionalEmail: true,
  transactionalPush: false,
  transactionalSms: false,
  marketingEmail: false,
  marketingPush: false,
  marketingSms: false,
}

const PREFERENCE_KEYS: Record<
  NotificationCategory,
  Record<NotificationChannel, keyof NotificationPreferences>
> = {
  transactional: {
    email: 'transactionalEmail',
    push: 'transactionalPush',
    sms: 'transactionalSms',
  },
  marketing: {
    email: 'marketingEmail',
    push: 'marketingPush',
    sms: 'marketingSms',
  },
}

const toPreferences = (
  row: typeof notificationPreferences.$inferSelect
): NotificationPreferences => ({
  transactionalEmail: row.transactionalEmail,
  transactionalPush: row.transactionalPush,
  transactionalSms: row.transactionalSms,
  marketingEmail: row.marketingEmail,
  marketingPush: row.marketingPush,
  marketingSms: row.marketingSms,
})

/** Returns the saved preferences for a user, or the defaults when unset. */
export const getNotificationPreferences = async (
  userId: string
): Promise<NotificationPreferences> => {
  const row = await drizzleDb.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  })
  return row ? toPreferences(row) : { ...DEFAULT_NOTIFICATION_PREFERENCES }
}

/**
 * Upserts the supplied subset of preferences and returns the merged result.
 *
 * The merge happens inside a single statement so two concurrent updates cannot
 * read stale values and overwrite each other's toggles.
 */
export const updateNotificationPreferences = async (
  userId: string,
  input: UpdateNotificationPreferencesInput
): Promise<NotificationPreferences> => {
  const [row] = await primaryDrizzleDb
    .insert(notificationPreferences)
    .values({ userId, ...DEFAULT_NOTIFICATION_PREFERENCES, ...input })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning()

  return toPreferences(row)
}

/** True when the user (or an unknown recipient) accepts this category/channel. */
export const isChannelEnabled = (
  preferences: NotificationPreferences,
  category: NotificationCategory,
  channel: NotificationChannel
): boolean => preferences[PREFERENCE_KEYS[category][channel]]

export interface NotificationRecipient {
  /** Null for guest recipients that have no user account. */
  readonly userId: string | null
  readonly preferences: NotificationPreferences
}

/**
 * Resolves the recipient behind an email address together with their
 * preferences.
 *
 * Guest checkouts have no user record; they keep the defaults so transactional
 * receipts are still delivered while marketing stays opt-in.
 */
export const resolveNotificationRecipient = async (
  email: string
): Promise<NotificationRecipient> => {
  const user = await drizzleDb.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  })
  if (!user) {
    return {
      userId: null,
      preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    }
  }
  return {
    userId: user.id,
    preferences: await getNotificationPreferences(user.id),
  }
}
