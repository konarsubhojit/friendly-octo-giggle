export {
  type OrderEmailItem,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
  type OrderRefundUpdateData,
  type RefundStatus,
  type AbandonedCartItem,
  type AbandonedCartReminderData,
  escapeHtml,
} from './templates'

export { sendEmail, deliverEmail, EmailDeliveryError } from './providers'
export type {
  EmailMessage,
  EmailDeliveryResult,
  EmailProviderName,
} from './providers'

export { sendWithRetry } from './retry'

import { sendWithRetry } from './retry'
import { deliverEmail, type EmailDeliveryResult } from './providers'
import {
  orderConfirmationTemplate,
  orderStatusUpdateTemplate,
  orderRefundUpdateTemplate,
  returnStatusUpdateTemplate,
  abandonedCartReminderTemplate,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
  type OrderRefundUpdateData,
  type ReturnStatusUpdateData,
  type AbandonedCartReminderData,
} from './templates'

/**
 * Awaitable counterparts of the `send*` helpers below.
 *
 * The `send*` helpers hand off to `waitUntil` and resolve immediately, which
 * makes them useless inside a durable step: the step would report success
 * while the send was still in flight, and a failure would never be retried.
 * These `deliver*` helpers await the send and propagate its failure instead,
 * so an Inngest step can retry it.
 */
export const deliverOrderConfirmationEmail = (
  data: OrderConfirmationData
): Promise<EmailDeliveryResult> =>
  deliverEmail({ to: data.to, ...orderConfirmationTemplate(data) })

export const deliverOrderStatusUpdateEmail = (
  data: OrderStatusUpdateData
): Promise<EmailDeliveryResult> =>
  deliverEmail({ to: data.to, ...orderStatusUpdateTemplate(data) })

export const deliverOrderRefundUpdateEmail = (
  data: OrderRefundUpdateData
): Promise<EmailDeliveryResult> =>
  deliverEmail({ to: data.to, ...orderRefundUpdateTemplate(data) })

export const deliverReturnStatusUpdateEmail = (
  data: ReturnStatusUpdateData
): Promise<EmailDeliveryResult> =>
  deliverEmail({ to: data.to, ...returnStatusUpdateTemplate(data) })

export const deliverAbandonedCartReminderEmail = (
  data: AbandonedCartReminderData
): Promise<EmailDeliveryResult> =>
  deliverEmail({ to: data.to, ...abandonedCartReminderTemplate(data) })

export const sendOrderConfirmationEmail = (
  data: OrderConfirmationData
): void => {
  const template = orderConfirmationTemplate(data)
  sendWithRetry(
    { to: data.to, ...template },
    { emailType: 'order_confirmation', referenceId: data.orderId }
  )
}

export const sendOrderStatusUpdateEmail = (
  data: OrderStatusUpdateData
): void => {
  const template = orderStatusUpdateTemplate(data)
  sendWithRetry(
    { to: data.to, ...template },
    { emailType: 'order_status_update', referenceId: data.orderId }
  )
}

export const sendOrderRefundUpdateEmail = (
  data: OrderRefundUpdateData
): void => {
  const template = orderRefundUpdateTemplate(data)
  sendWithRetry(
    { to: data.to, ...template },
    { emailType: 'order_refund_update', referenceId: data.orderId }
  )
}

export const sendAbandonedCartReminderEmail = (
  data: AbandonedCartReminderData & { cartId: string }
): void => {
  const template = abandonedCartReminderTemplate(data)
  sendWithRetry(
    { to: data.to, ...template },
    { emailType: 'abandoned_cart_reminder', referenceId: data.cartId }
  )
}
