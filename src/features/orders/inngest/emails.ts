import { inngest } from '@/lib/inngest/client'
import {
  orderCreated,
  orderRefunded,
  orderStatusChanged,
} from '@/features/orders/inngest/events'
import {
  deliverOrderConfirmationNotification,
  deliverOrderRefundNotification,
  deliverOrderStatusNotification,
  type NotificationDeliveryResult,
} from '@/lib/notifications/order-notifications'
import { getShippingMethodLabel } from '@/lib/shipping/methods'
import { formatPriceForCurrency, type CurrencyCode } from '@/lib/currency'
import { saveFailedEmail, type EmailType } from '@/lib/email/failed-emails'
import { logError, logger } from '@/lib/logger'
import type { ScoringStep } from '@/lib/inngest/scores'
import { scoreEmailDelivery } from '@/lib/inngest/scores'

/**
 * Four attempts. Transactional email is worth persisting through a provider
 * blip, but a customer waiting on a confirmation is not served by an hours-long
 * backoff tail — anything still failing after this lands in `failedEmails`,
 * where the nightly retry function picks it up.
 */
export const EMAIL_FUNCTION_RETRIES = 3

const formatOptional = (
  amount: number | undefined,
  currency: CurrencyCode
): string | null =>
  amount === undefined ? null : formatPriceForCurrency(amount, currency)

/**
 * Records a permanently undeliverable email so the admin failed-email surface
 * and the nightly retry function can still see it.
 *
 * This is the `onFailure` path: Inngest has already exhausted its retries, so
 * the row is written as non-retriable at the transport level but kept visible.
 */
const recordEmailFailure = async ({
  recipientEmail,
  emailType,
  referenceId,
  error,
}: {
  recipientEmail: string
  emailType: EmailType
  referenceId: string
  error: unknown
}): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error)

  logError({
    error,
    context: 'inngest_email_retries_exhausted',
    additionalInfo: { emailType, referenceId },
  })

  try {
    await saveFailedEmail({
      recipientEmail,
      subject: emailType,
      bodyHtml: '',
      bodyText: '',
      emailType,
      referenceId,
      errorHistory: [
        {
          attempt: EMAIL_FUNCTION_RETRIES + 1,
          timestamp: new Date().toISOString(),
          error: message,
          provider: 'unknown',
        },
      ],
      isRetriable: false,
      attemptCount: EMAIL_FUNCTION_RETRIES + 1,
      lastError: message,
    })
  } catch (saveError) {
    // Nothing further to escalate to — losing the bookkeeping row must not
    // mask the original delivery failure in the run history.
    logError({
      error: saveError,
      context: 'inngest_email_failure_record_write',
      additionalInfo: { emailType, referenceId },
    })
  }
}

/**
 * Emit the delivery scores shared by every transactional email function, then
 * return a JSON-safe summary for the run history.
 */
const finishEmailRun = async (
  step: ScoringStep,
  emailType: EmailType,
  referenceId: string,
  result: NotificationDeliveryResult
) => {
  await scoreEmailDelivery(step, result)

  logger.info(
    {
      emailType,
      referenceId,
      suppressed: result.emailSuppressed,
      delivered: result.emailDelivered,
    },
    'inngest_email_dispatched'
  )

  return {
    referenceId,
    emailType,
    suppressed: result.emailSuppressed,
    delivered: result.emailDelivered,
    usedFallbackProvider: result.usedFallbackProvider,
  }
}

/**
 * Order confirmation email.
 *
 * `idempotency` on the order id replaces the `failedEmails` lookup the QStash
 * worker ran on every message purely to dedupe — an order is confirmed once,
 * so a duplicate publish collapses into the same run.
 */
export const sendOrderConfirmationEmailFunction = inngest.createFunction(
  {
    id: 'send-order-confirmation-email',
    name: 'Send order confirmation email',
    triggers: [orderCreated],
    retries: EMAIL_FUNCTION_RETRIES,
    idempotency: 'event.data.orderId',
    onFailure: ({ event, error }) =>
      recordEmailFailure({
        recipientEmail: event.data.event.data.customerEmail,
        emailType: 'order_confirmation',
        referenceId: event.data.event.data.orderId,
        error,
      }),
  },
  async ({ event, step }) => {
    const data = event.data
    const currency = data.currencyCode

    const result = await step.run('deliver-confirmation', () =>
      deliverOrderConfirmationNotification({
        to: data.customerEmail,
        customerName: data.customerName,
        orderId: data.orderId,
        subtotalAmount: formatOptional(data.subtotalAmount, currency),
        shippingAmount: formatOptional(data.shippingAmount, currency),
        taxAmount: formatOptional(data.taxAmount, currency),
        shippingMethodLabel: data.shippingMethod
          ? getShippingMethodLabel(data.shippingMethod)
          : null,
        totalAmount: formatPriceForCurrency(data.totalAmount, currency),
        discountAmount: data.discountAmount
          ? formatPriceForCurrency(data.discountAmount, currency)
          : null,
        couponCode: data.couponCode ?? null,
        shippingAddress: data.customerAddress,
        items: data.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: formatPriceForCurrency(item.price, currency),
          variant: null,
        })),
      })
    )

    return finishEmailRun(step, 'order_confirmation', data.orderId, result)
  }
)

/**
 * Order status update email.
 *
 * The idempotency key has to include the status: an order legitimately moves
 * through several statuses and each one earns its own email.
 */
export const sendOrderStatusEmailFunction = inngest.createFunction(
  {
    id: 'send-order-status-email',
    name: 'Send order status email',
    triggers: [orderStatusChanged],
    retries: EMAIL_FUNCTION_RETRIES,
    idempotency: 'event.data.orderId + "-" + event.data.newStatus',
    onFailure: ({ event, error }) =>
      recordEmailFailure({
        recipientEmail: event.data.event.data.customerEmail,
        emailType: 'order_status_update',
        referenceId: event.data.event.data.orderId,
        error,
      }),
  },
  async ({ event, step }) => {
    const data = event.data

    const result = await step.run('deliver-status-update', () =>
      deliverOrderStatusNotification({
        to: data.customerEmail,
        customerName: data.customerName,
        orderId: data.orderId,
        status: data.newStatus,
        trackingNumber: data.trackingNumber,
        shippingProvider: data.shippingProvider,
      })
    )

    return finishEmailRun(step, 'order_status_update', data.orderId, result)
  }
)

/**
 * Refund update email.
 *
 * Keyed on the refund id as well as the order id, because an order can be
 * partially refunded more than once.
 */
export const sendOrderRefundEmailFunction = inngest.createFunction(
  {
    id: 'send-order-refund-email',
    name: 'Send order refund email',
    triggers: [orderRefunded],
    retries: EMAIL_FUNCTION_RETRIES,
    idempotency:
      'event.data.orderId + "-" + event.data.refundId + "-" + event.data.refundStatus',
    onFailure: ({ event, error }) =>
      recordEmailFailure({
        recipientEmail: event.data.event.data.customerEmail,
        emailType: 'order_refund_update',
        referenceId: event.data.event.data.orderId,
        error,
      }),
  },
  async ({ event, step }) => {
    const data = event.data
    const currency = data.currencyCode

    const result = await step.run('deliver-refund-update', () =>
      deliverOrderRefundNotification({
        to: data.customerEmail,
        customerName: data.customerName,
        orderId: data.orderId,
        status: data.refundStatus,
        refundAmount: formatPriceForCurrency(data.refundAmount, currency),
        isPartial: data.isPartial,
        reason: data.reason ?? null,
      })
    )

    return finishEmailRun(step, 'order_refund_update', data.orderId, result)
  }
)
