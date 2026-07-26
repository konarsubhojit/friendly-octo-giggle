import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull, lt, ne } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import { checkoutRequests, orders, webhookEvents } from '@/lib/schema'
import {
  getPaymentGateway,
  PaymentConfigurationError,
  PaymentVerificationError,
  type PaymentWebhookEvent,
} from '@/lib/payments'
import type { PaymentProvider } from '@/lib/types'
import { fromMinorUnits } from '@/lib/money'
import { logBusinessEvent, logError } from '@/lib/logger'
import { processCheckoutRequestById } from '@/features/cart/services/checkout-service'

/** Checkout request states that must never be re-processed by a webhook. */
const NON_REPROCESSABLE_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'PROCESSING',
])

/**
 * A claimed-but-unprocessed webhook older than this is treated as abandoned
 * (the process died mid-flight) and may be reclaimed by a gateway retry.
 */
const STALE_WEBHOOK_CLAIM_MS = 5 * 60 * 1000

/**
 * Claim a webhook delivery by inserting its event id. Gateways retry events
 * aggressively (and can deliver the same event concurrently), so the unique
 * (provider, eventId) constraint is what makes processing exactly-once: the
 * loser of the insert race gets no row back and skips all side effects.
 *
 * If a previous delivery claimed the event but never recorded completion — for
 * example the function timed out or the process was killed — the claim is
 * reclaimed once it goes stale so the retry can finish the work.
 *
 * @returns true when this delivery owns the event and must process it.
 */
const claimWebhookEvent = async ({
  provider,
  eventId,
  eventType,
}: {
  provider: PaymentProvider
  eventId: string
  eventType: string
}): Promise<boolean> => {
  const claimed = await primaryDrizzleDb
    .insert(webhookEvents)
    .values({ provider, eventId, eventType })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventId],
    })
    .returning({ id: webhookEvents.id })

  if (claimed.length > 0) {
    return true
  }

  const staleBefore = new Date(Date.now() - STALE_WEBHOOK_CLAIM_MS)
  const reclaimed = await primaryDrizzleDb
    .update(webhookEvents)
    .set({ receivedAt: new Date() })
    .where(
      and(
        eq(webhookEvents.provider, provider),
        eq(webhookEvents.eventId, eventId),
        isNull(webhookEvents.processedAt),
        lt(webhookEvents.receivedAt, staleBefore)
      )
    )
    .returning({ id: webhookEvents.id })

  return reclaimed.length > 0
}

/** Record that the event's side effects committed, closing the claim. */
const completeWebhookEvent = async (
  provider: PaymentProvider,
  eventId: string
): Promise<void> => {
  await primaryDrizzleDb
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(
      and(
        eq(webhookEvents.provider, provider),
        eq(webhookEvents.eventId, eventId)
      )
    )
}

const releaseWebhookEvent = async (
  provider: PaymentProvider,
  eventId: string
): Promise<void> => {
  await primaryDrizzleDb
    .delete(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, provider),
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

const applyWebhookEvent = async (event: PaymentWebhookEvent) => {
  if (event.type === 'payment.captured') {
    if (typeof event.amountInMinorUnits !== 'number') {
      throw new PaymentVerificationError(
        'Invalid payment amount in webhook payload'
      )
    }

    await handleCapturedPayment({
      paymentId: event.paymentId,
      paymentOrderId: event.paymentOrderId,
      amount: event.amountInMinorUnits,
    })
  }

  if (event.type === 'payment.failed') {
    await handleFailedPayment({ paymentId: event.paymentId })
  }
}

/**
 * Handle an inbound payment webhook for a specific provider.
 *
 * Signature verification and payload parsing are delegated to the provider's
 * gateway, so adding a provider requires no changes here.
 */
export const handlePaymentWebhook = async (
  request: NextRequest,
  provider: string
): Promise<NextResponse> => {
  let event: PaymentWebhookEvent | undefined

  try {
    const gateway = getPaymentGateway(provider)
    const rawBody = await request.text()

    event = gateway.verifyWebhook({
      payload: rawBody,
      headers: request.headers,
    })

    const isFirstDelivery = await claimWebhookEvent({
      provider: gateway.provider,
      eventId: event.eventId,
      eventType: event.eventType,
    })

    if (!isFirstDelivery) {
      // Replays and duplicate deliveries are a no-op, but must still be
      // acknowledged so the gateway stops retrying.
      logBusinessEvent({
        event: 'payment_webhook_duplicate_ignored',
        details: {
          provider: gateway.provider,
          eventId: event.eventId,
          eventType: event.eventType,
          paymentId: event.paymentId,
        },
        success: true,
      })
      return NextResponse.json({ ok: true, duplicate: true })
    }

    try {
      await applyWebhookEvent(event)
      await completeWebhookEvent(gateway.provider, event.eventId)
    } catch (error) {
      // Release the claim so the gateway's retry can reprocess the event
      // instead of it being permanently swallowed as a duplicate.
      await releaseWebhookEvent(gateway.provider, event.eventId).catch(
        (releaseError) => {
          logError({
            error: releaseError,
            context: 'payment_webhook_release_claim_failed',
            additionalInfo: { provider, eventId: event?.eventId },
          })
        }
      )
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

    logError({
      error,
      context: 'payment_webhook_processing_failed',
      additionalInfo: { provider },
    })
    return NextResponse.json(
      { error: 'Failed to process payment webhook' },
      { status: 500 }
    )
  }
}
