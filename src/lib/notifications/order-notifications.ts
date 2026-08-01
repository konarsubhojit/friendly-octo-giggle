import {
  sendOrderConfirmationEmail,
  sendOrderRefundUpdateEmail,
  sendOrderStatusUpdateEmail,
  deliverOrderConfirmationEmail,
  deliverOrderRefundUpdateEmail,
  deliverOrderStatusUpdateEmail,
} from '@/lib/email'
import type { EmailDeliveryResult } from '@/lib/email'
import type {
  OrderConfirmationData,
  OrderRefundUpdateData,
  OrderStatusUpdateData,
} from '@/lib/email/templates'
import {
  isChannelEnabled,
  resolveNotificationRecipient,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationRecipient,
} from '@/features/account/services/notification-preferences'
import { sendPushToUser } from '@/lib/notifications/push'
import { logError, logger } from '@/lib/logger'

const allows = (
  recipient: NotificationRecipient,
  category: NotificationCategory,
  channel: NotificationChannel
): boolean => isChannelEnabled(recipient.preferences, category, channel)

/**
 * What a durable notification actually did.
 *
 * The caller needs to tell "suppressed by preference" apart from "delivered"
 * apart from "no provider configured" — all three are successes, but only one
 * of them should count towards a delivery score.
 */
export interface NotificationDeliveryResult {
  readonly emailSuppressed: boolean
  readonly emailDelivered: boolean
  readonly usedFallbackProvider: boolean
  readonly pushDelivered: boolean
}

const SUPPRESSED: EmailDeliveryResult = {
  delivered: false,
  provider: null,
  usedFallbackProvider: false,
}

interface PushMessage {
  readonly title: string
  readonly body: string
  readonly url: string
  readonly tag: string
}

/**
 * Shared body for the durable `deliver*` notifications.
 *
 * Email is awaited so a provider failure propagates and the calling step can
 * be retried. Push is deliberately not: a failed push must not cause the email
 * to be sent twice on retry, so its failure is logged and swallowed.
 */
const deliverNotification = async ({
  to,
  orderId,
  deliverEmailFor,
  buildPush,
}: {
  to: string
  orderId: string
  deliverEmailFor: () => Promise<EmailDeliveryResult>
  buildPush: () => PushMessage
}): Promise<NotificationDeliveryResult> => {
  const recipient = await resolveNotificationRecipient(to)
  const emailAllowed = allows(recipient, 'transactional', 'email')

  if (!emailAllowed) {
    logger.info({ orderId, channel: 'email' }, 'notification_suppressed_by_preference')
  }

  const emailResult = emailAllowed ? await deliverEmailFor() : SUPPRESSED

  let pushDelivered = false
  if (recipient.userId && allows(recipient, 'transactional', 'push')) {
    try {
      await sendPushToUser(recipient.userId, buildPush())
      pushDelivered = true
    } catch (error) {
      logError({
        error,
        context: 'notification_push_failed',
        additionalInfo: { orderId },
      })
    }
  }

  return {
    emailSuppressed: !emailAllowed,
    emailDelivered: emailResult.delivered,
    usedFallbackProvider: emailResult.usedFallbackProvider,
    pushDelivered,
  }
}

const ORDER_STATUS_TITLES: Record<string, string> = {
  PROCESSING: 'Your order is being prepared',
  SHIPPED: 'Your order has shipped',
  DELIVERED: 'Your order has been delivered',
  CANCELLED: 'Your order was cancelled',
}

const buildConfirmationPush = (data: OrderConfirmationData): PushMessage => ({
  title: 'Order confirmed',
  body: `Thanks! Order #${data.orderId.toUpperCase()} totalling ${data.totalAmount} is confirmed.`,
  url: `/orders/${data.orderId}`,
  tag: `order-${data.orderId}`,
})

const buildStatusPush = (data: OrderStatusUpdateData): PushMessage => {
  const trackingSuffix = data.trackingNumber
    ? ` Tracking: ${data.trackingNumber}.`
    : ''
  return {
    title: ORDER_STATUS_TITLES[data.status] ?? 'Order update',
    body: `Order #${data.orderId.toUpperCase()} is now ${data.status.toLowerCase()}.${trackingSuffix}`,
    url: `/orders/${data.orderId}`,
    tag: `order-${data.orderId}`,
  }
}

const REFUND_PUSH_TITLES: Record<string, string> = {
  PENDING: 'Refund initiated',
  PROCESSED: 'Refund completed',
  FAILED: 'Refund failed',
}

const buildRefundPush = (data: OrderRefundUpdateData): PushMessage => ({
  title: REFUND_PUSH_TITLES[data.status] ?? 'Refund update',
  body: `Refund of ${data.refundAmount} for order #${data.orderId.toUpperCase()}.`,
  url: `/orders/${data.orderId}`,
  tag: `order-${data.orderId}`,
})

/** Durable order confirmation: awaits the email so a failure can be retried. */
export const deliverOrderConfirmationNotification = (
  data: OrderConfirmationData
): Promise<NotificationDeliveryResult> =>
  deliverNotification({
    to: data.to,
    orderId: data.orderId,
    deliverEmailFor: () => deliverOrderConfirmationEmail(data),
    buildPush: () => buildConfirmationPush(data),
  })

/** Durable order status update: awaits the email so a failure can be retried. */
export const deliverOrderStatusNotification = (
  data: OrderStatusUpdateData
): Promise<NotificationDeliveryResult> =>
  deliverNotification({
    to: data.to,
    orderId: data.orderId,
    deliverEmailFor: () => deliverOrderStatusUpdateEmail(data),
    buildPush: () => buildStatusPush(data),
  })

/** Durable refund update: awaits the email so a failure can be retried. */
export const deliverOrderRefundNotification = (
  data: OrderRefundUpdateData
): Promise<NotificationDeliveryResult> =>
  deliverNotification({
    to: data.to,
    orderId: data.orderId,
    deliverEmailFor: () => deliverOrderRefundUpdateEmail(data),
    buildPush: () => buildRefundPush(data),
  })

/**
 * Fans out an order-confirmation notification across the channels the customer
 * has opted into. Push failures never block the email path.
 */
export const notifyOrderConfirmation = async (
  data: OrderConfirmationData
): Promise<void> => {
  const recipient = await resolveNotificationRecipient(data.to)

  if (allows(recipient, 'transactional', 'email')) {
    sendOrderConfirmationEmail(data)
  } else {
    logger.info(
      { orderId: data.orderId, channel: 'email' },
      'notification_suppressed_by_preference'
    )
  }

  if (recipient.userId && allows(recipient, 'transactional', 'push')) {
    await sendPushToUser(recipient.userId, buildConfirmationPush(data))
  }
}

/**
 * Fans out an order status update across the channels the customer has opted
 * into. Push failures never block the email path.
 */
export const notifyOrderStatusUpdate = async (
  data: OrderStatusUpdateData
): Promise<void> => {
  const recipient = await resolveNotificationRecipient(data.to)

  if (allows(recipient, 'transactional', 'email')) {
    sendOrderStatusUpdateEmail(data)
  } else {
    logger.info(
      { orderId: data.orderId, channel: 'email' },
      'notification_suppressed_by_preference'
    )
  }

  if (recipient.userId && allows(recipient, 'transactional', 'push')) {
    await sendPushToUser(recipient.userId, buildStatusPush(data))
  }
}

/**
 * Fans out a refund update across the channels the customer has opted into.
 * Push failures never block the email path.
 */
export const notifyOrderRefundUpdate = async (
  data: OrderRefundUpdateData
): Promise<void> => {
  const recipient = await resolveNotificationRecipient(data.to)

  if (allows(recipient, 'transactional', 'email')) {
    sendOrderRefundUpdateEmail(data)
  } else {
    logger.info(
      { orderId: data.orderId, channel: 'email' },
      'notification_suppressed_by_preference'
    )
  }

  if (recipient.userId && allows(recipient, 'transactional', 'push')) {
    await sendPushToUser(recipient.userId, buildRefundPush(data))
  }
}
