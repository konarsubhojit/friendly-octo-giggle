import { NextRequest, NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import { checkoutRequests, orders, webhookEvents } from '@/lib/schema'
import {
  PaymentConfigurationError,
  PaymentVerificationError,
  verifyRazorpayWebhookSignature,
} from '@/lib/payments'
import { fromMinorUnits } from '@/lib/money'
import { logBusinessEvent, logError } from '@/lib/logger'
import { processCheckoutRequestById } from '@/features/cart/services/checkout-service'

export const dynamic = 'force-dynamic'

const WEBHOOK_PROVIDER = 'RAZORPAY' as const

/** Checkout request states that must never be re-processed by a webhook. */
const NON_REPROCESSABLE_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'PROCESSING',
])

interface RazorpayWebhookEvent {
  event: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
        amount?: number
      }
    }
  }
}

/**
 * Claim a webhook delivery by inserting its event id. Razorpay retries events
 * aggressively (and can deliver the same event concurrently), so the unique
 * (provider, eventId) constraint is what makes processing exactly-once: the
 * loser of the insert race gets no row back and skips all side effects.
 *
 * @returns true when this delivery is the first one for the event.
 */
const claimWebhookEvent = async ({
  eventId,
  eventType,
}: {
  eventId: string
  eventType: string
}): Promise<boolean> => {
  const claimed = await primaryDrizzleDb
    .insert(webhookEvents)
    .values({ provider: WEBHOOK_PROVIDER, eventId, eventType })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventId],
    })
    .returning({ id: webhookEvents.id })

  return claimed.length > 0
}

const releaseWebhookEvent = async (eventId: string): Promise<void> => {
  await primaryDrizzleDb
    .delete(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, WEBHOOK_PROVIDER),
        eq(webhookEvents.eventId, eventId)
      )
    )
}

/**
 * Reconcile a captured payment inside a single transaction.
 *
 * The order and checkout-request rows are locked with `SELECT ... FOR UPDATE`
 * so a concurrent delivery blocks until this transaction commits and then sees
 * the updated state instead of duplicating the transition.
 *
 * @returns the checkout request id that still needs processing, if any.
 */
const reconcileCapturedPayment = async ({
  paymentId,
  paymentOrderId,
  amount,
}: {
  paymentId: string
  paymentOrderId: string
  amount: number
}): Promise<string | null> =>
  primaryDrizzleDb.transaction(async (tx) => {
    const [existingOrder] = await tx
      .select({
        id: orders.id,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(eq(orders.paymentTransactionId, paymentId))
      .limit(1)
      .for('update')

    if (existingOrder) {
      if (existingOrder.paymentStatus !== 'PAID') {
        await tx
          .update(orders)
          .set({
            paymentStatus: 'PAID',
            amountPaid: fromMinorUnits(amount),
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(orders.id, existingOrder.id),
              ne(orders.paymentStatus, 'PAID')
            )
          )
      }
      return null
    }

    const [checkoutRequest] = await tx
      .select({
        id: checkoutRequests.id,
        status: checkoutRequests.status,
      })
      .from(checkoutRequests)
      .where(
        and(
          eq(checkoutRequests.paymentTransactionId, paymentId),
          eq(checkoutRequests.paymentOrderId, paymentOrderId)
        )
      )
      .limit(1)
      .for('update')

    if (
      !checkoutRequest ||
      NON_REPROCESSABLE_STATUSES.has(checkoutRequest.status)
    ) {
      return null
    }

    return checkoutRequest.id
  })

const handleCapturedPayment = async (input: {
  paymentId: string
  paymentOrderId: string
  amount: number
}) => {
  const checkoutRequestId = await reconcileCapturedPayment(input)

  if (checkoutRequestId) {
    // Safe to run outside the transaction: processing is itself guarded by a
    // compare-and-swap on the checkout request status.
    await processCheckoutRequestById(checkoutRequestId)
  }
}

const handleFailedPayment = async ({ paymentId }: { paymentId: string }) => {
  await Promise.all([
    primaryDrizzleDb
      .update(checkoutRequests)
      .set({
        status: 'FAILED',
        errorMessage: 'Payment failed',
        updatedAt: new Date(),
      })
      .where(eq(checkoutRequests.paymentTransactionId, paymentId)),
    primaryDrizzleDb
      .update(orders)
      .set({
        paymentStatus: 'FAILED',
        updatedAt: new Date(),
      })
      .where(eq(orders.paymentTransactionId, paymentId)),
  ])
}

/**
 * Razorpay sends a stable event id in the `x-razorpay-event-id` header. When it
 * is absent (older integrations, manual replays) fall back to a deterministic
 * key so duplicates are still collapsed.
 */
const resolveEventId = (
  request: NextRequest,
  eventType: string,
  paymentId: string
): string =>
  request.headers.get('x-razorpay-event-id')?.trim() ||
  `${eventType}:${paymentId}`

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature')
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 400 }
      )
    }

    verifyRazorpayWebhookSignature({ payload: rawBody, signature })

    const event = JSON.parse(rawBody) as RazorpayWebhookEvent
    const paymentEntity = event.payload?.payment?.entity
    const paymentId = paymentEntity?.id
    const paymentOrderId = paymentEntity?.order_id

    if (!paymentId || !paymentOrderId) {
      return NextResponse.json(
        { error: 'Invalid payment webhook payload' },
        { status: 400 }
      )
    }

    if (
      event.event === 'payment.captured' &&
      typeof paymentEntity.amount !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Invalid payment amount in webhook payload' },
        { status: 400 }
      )
    }

    const eventId = resolveEventId(request, event.event, paymentId)
    const isFirstDelivery = await claimWebhookEvent({
      eventId,
      eventType: event.event,
    })

    if (!isFirstDelivery) {
      // Replays and duplicate deliveries are a no-op, but must still be
      // acknowledged so the gateway stops retrying.
      logBusinessEvent({
        event: 'payment_webhook_duplicate_ignored',
        details: { eventId, eventType: event.event, paymentId },
        success: true,
      })
      return NextResponse.json({ ok: true, duplicate: true })
    }

    try {
      if (event.event === 'payment.captured') {
        await handleCapturedPayment({
          paymentId,
          paymentOrderId,
          amount: paymentEntity.amount as number,
        })
      }

      if (event.event === 'payment.failed') {
        await handleFailedPayment({ paymentId })
      }
    } catch (error) {
      // Release the claim so the gateway's retry can reprocess the event
      // instead of it being permanently swallowed as a duplicate.
      await releaseWebhookEvent(eventId).catch((releaseError) => {
        logError({
          error: releaseError,
          context: 'payment_webhook_release_claim_failed',
          additionalInfo: { eventId },
        })
      })
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (
      error instanceof PaymentVerificationError ||
      error instanceof PaymentConfigurationError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    logError({ error, context: 'payment_webhook_processing_failed' })
    return NextResponse.json(
      { error: 'Failed to process payment webhook' },
      { status: 500 }
    )
  }
}
