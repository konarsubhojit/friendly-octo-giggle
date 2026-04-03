import { type NextRequest, NextResponse } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { getQStashReceiver } from '@/lib/qstash'
import { QStashEmailEventSchema } from '@/lib/qstash-events'
import type { z } from 'zod'
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
} from '@/lib/email'
import { isNonRetriableError } from '@/lib/email/retry'
import { saveFailedEmail } from '@/lib/email/failed-emails'
import type { EmailType } from '@/lib/email/failed-emails'
import { logBusinessEvent, logError, logger } from '@/lib/logger'
import { env } from '@/lib/env'
import { drizzleDb } from '@/lib/db'
import { failedEmails } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import {
  formatPriceForCurrency,
  isValidCurrencyCode,
  type CurrencyCode,
} from '@/lib/currency'

const resolveEmailType = (
  eventType: 'order.created' | 'order.status_changed'
): EmailType =>
  eventType === 'order.created' ? 'order_confirmation' : 'order_status_update'

const verifyQStashSignature = async (
  request: NextRequest,
  bodyText: string,
  messageId: string | undefined
): Promise<NextResponse | null> => {
  if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
    return null
  }
  const signature = request.headers.get('Upstash-Signature')
  if (!signature) {
    logger.warn({ messageId }, 'qstash_signature_invalid')
    return apiError('Invalid signature', 401)
  }
  try {
    await getQStashReceiver().verify({ signature, body: bodyText })
    return null
  } catch {
    logger.warn({ messageId }, 'qstash_signature_invalid')
    return apiError('Invalid signature', 401)
  }
}

type QStashEvent = z.infer<typeof QStashEmailEventSchema>

const dispatchEmail = (event: QStashEvent): void => {
  if (event.type === 'order.created') {
    const currency: CurrencyCode =
      event.data.currencyCode && isValidCurrencyCode(event.data.currencyCode)
        ? event.data.currencyCode
        : 'INR'
    sendOrderConfirmationEmail({
      to: event.data.customerEmail,
      customerName: event.data.customerName,
      orderId: event.data.orderId,
      totalAmount: formatPriceForCurrency(event.data.totalAmount, currency),
      shippingAddress: event.data.customerAddress,
      items: event.data.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: formatPriceForCurrency(item.price, currency),
        variation: null,
      })),
    })
  } else {
    sendOrderStatusUpdateEmail({
      to: event.data.customerEmail,
      customerName: event.data.customerName,
      orderId: event.data.orderId,
      status: event.data.newStatus,
      trackingNumber: event.data.trackingNumber,
      shippingProvider: event.data.shippingProvider,
    })
  }
}

const handleEmailSendError = async (
  sendError: unknown,
  event: QStashEvent,
  emailType: EmailType,
  orderId: string,
  messageId: string | undefined
): Promise<NextResponse> => {
  if (!isNonRetriableError(sendError)) {
    logError({
      error: sendError,
      context: 'qstash_email_send_transient',
      additionalInfo: { messageId, orderId, eventType: event.type },
    })
    return apiError('Internal error', 500)
  }
  logError({
    error: sendError,
    context: 'qstash_email_send_nonretriable',
    additionalInfo: { messageId, orderId, eventType: event.type },
  })
  const errorMsg =
    sendError instanceof Error ? sendError.message : String(sendError)
  await saveFailedEmail({
    recipientEmail: event.data.customerEmail,
    subject: emailType,
    bodyHtml: '',
    bodyText: '',
    emailType,
    referenceId: orderId,
    errorHistory: [
      {
        attempt: 1,
        timestamp: new Date().toISOString(),
        error: errorMsg,
        provider: 'unknown',
      },
    ],
    isRetriable: false,
    attemptCount: 1,
    lastError: errorMsg,
  })
  return apiError('Permanent failure', 400)
}

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const messageId = request.headers.get('Upstash-Message-Id') ?? undefined
  const bodyText = await request.text()

  const signatureError = await verifyQStashSignature(
    request,
    bodyText,
    messageId
  )
  if (signatureError) return signatureError

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(bodyText)
  } catch {
    return apiError('Invalid payload', 400)
  }

  const parseResult = QStashEmailEventSchema.safeParse(parsedBody)
  if (!parseResult.success) {
    return apiError('Invalid payload', 400)
  }

  const event = parseResult.data
  const emailType = resolveEmailType(event.type)
  const orderId = event.data.orderId

  const existingRecord = await drizzleDb.query.failedEmails.findFirst({
    where: and(
      eq(failedEmails.referenceId, orderId),
      eq(failedEmails.emailType, emailType),
      eq(failedEmails.status, 'sent')
    ),
  })

  if (existingRecord) {
    logger.info(
      { messageId, orderId, eventType: event.type },
      'qstash_duplicate_event_skipped'
    )
    return apiSuccess({ skipped: true })
  }

  try {
    dispatchEmail(event)
    logger.info(
      { messageId, orderId, eventType: event.type },
      'qstash_email_sent'
    )
    logBusinessEvent({
      event: 'qstash_email_sent',
      details: { messageId, orderId, eventType: event.type },
      success: true,
    })
    return apiSuccess({ sent: true })
  } catch (sendError) {
    return handleEmailSendError(sendError, event, emailType, orderId, messageId)
  }
}
