import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
} from '@/lib/email'
import type {
  OrderConfirmationData,
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
import { logger } from '@/lib/logger'

const allows = (
  recipient: NotificationRecipient,
  category: NotificationCategory,
  channel: NotificationChannel
): boolean => isChannelEnabled(recipient.preferences, category, channel)

const ORDER_STATUS_TITLES: Record<string, string> = {
  PROCESSING: 'Your order is being prepared',
  SHIPPED: 'Your order has shipped',
  DELIVERED: 'Your order has been delivered',
  CANCELLED: 'Your order was cancelled',
}

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
    await sendPushToUser(recipient.userId, {
      title: 'Order confirmed',
      body: `Thanks! Order #${data.orderId.toUpperCase()} totalling ${data.totalAmount} is confirmed.`,
      url: `/orders/${data.orderId}`,
      tag: `order-${data.orderId}`,
    })
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
    const title = ORDER_STATUS_TITLES[data.status] ?? 'Order update'
    const trackingSuffix = data.trackingNumber
      ? ` Tracking: ${data.trackingNumber}.`
      : ''
    await sendPushToUser(recipient.userId, {
      title,
      body: `Order #${data.orderId.toUpperCase()} is now ${data.status.toLowerCase()}.${trackingSuffix}`,
      url: `/orders/${data.orderId}`,
      tag: `order-${data.orderId}`,
    })
  }
}
