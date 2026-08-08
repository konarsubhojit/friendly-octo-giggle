import type { NotificationPreferences } from '@/features/account/services/notification-preferences'

export type { NotificationPreferences }

export type PreferenceKey = keyof NotificationPreferences

interface ChannelOption {
  readonly key: PreferenceKey
  readonly label: string
}

interface NotificationGroup {
  readonly category: 'transactional' | 'marketing'
  readonly title: string
  readonly description: string
  readonly channels: ReadonlyArray<ChannelOption>
}

export const NOTIFICATION_GROUPS: ReadonlyArray<NotificationGroup> = [
  {
    category: 'transactional',
    title: 'Order updates',
    description: 'Confirmations and status changes for orders you have placed.',
    channels: [
      { key: 'transactionalEmail', label: 'Email' },
      { key: 'transactionalPush', label: 'Browser push' },
      { key: 'transactionalSms', label: 'SMS / WhatsApp' },
    ],
  },
  {
    category: 'marketing',
    title: 'Offers and reminders',
    description:
      'Promotions, price drops and reminders such as an abandoned cart.',
    channels: [
      { key: 'marketingEmail', label: 'Email' },
      { key: 'marketingPush', label: 'Browser push' },
      { key: 'marketingSms', label: 'SMS / WhatsApp' },
    ],
  },
]

/**
 * Converts a base64url VAPID public key into the `Uint8Array` the Push API
 * requires for `applicationServerKey`.
 */
export const urlBase64ToUint8Array = (
  base64String: string
): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replaceAll('-', '+')
    .replaceAll('_', '/')
  const rawData = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.codePointAt(i) ?? 0
  }
  return output
}
