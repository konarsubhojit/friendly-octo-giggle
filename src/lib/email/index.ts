export {
  type OrderEmailItem,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
  type OrderRefundUpdateData,
  type RefundStatus,
  escapeHtml,
} from './templates'

export { sendEmail, type EmailMessage } from './providers'

export { sendWithRetry } from './retry'

import { sendWithRetry } from './retry'
import {
  orderConfirmationTemplate,
  orderStatusUpdateTemplate,
  orderRefundUpdateTemplate,
  type OrderConfirmationData,
  type OrderStatusUpdateData,
  type OrderRefundUpdateData,
} from './templates'

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
