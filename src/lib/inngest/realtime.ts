/**
 * Realtime push for checkout settlement.
 *
 * The payment page used to poll `GET /api/checkout/{id}` until the order
 * existed. Polling paid for the wait twice — once in perceived latency (the
 * customer waits for the next tick, not for the order) and once in rate-limit
 * budget, because every in-flight checkout spent tokens on a bucket shared with
 * the rest of the API.
 *
 * A checkout run instead announces its own terminal state on a per-request
 * Realtime channel, and `GET /api/checkout/{id}/stream` bridges that channel to
 * the browser as Server-Sent Events. The SDK therefore stays on the server: the
 * browser needs no subscription token and ships no extra client bundle.
 *
 * Everything here is best-effort. A dropped publish costs latency, never
 * correctness — the database remains the source of truth and the bridge
 * re-reads it on a timer.
 */

import { channel } from 'inngest/realtime'
import { z } from 'zod'
import { inngest, isInngestConfigured } from '@/lib/inngest/client'
import { raceWithTimeout } from '@/lib/inngest/dispatch'
import { logError } from '@/lib/logger'
import { SHORT_ID_REGEX } from '@/lib/validations/primitives'

/**
 * Payload pushed when a checkout request reaches a terminal state.
 *
 * Deliberately the same shape as `CheckoutRequestStatusResponse`, so the
 * browser can treat a pushed message and a re-read of the status endpoint as
 * one type and hold a single code path for both.
 */
export const CheckoutStatusMessageSchema = z.object({
  checkoutRequestId: z.string().regex(SHORT_ID_REGEX),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  orderId: z.string().nullable(),
  error: z.string().nullable(),
})

export type CheckoutStatusMessage = z.infer<typeof CheckoutStatusMessageSchema>

/**
 * One channel per checkout request.
 *
 * Scoping by request id — rather than by user — is what lets the bridge grant
 * a subscription after a single ownership check: the channel carries nothing
 * the requesting customer is not already entitled to read.
 */
export const checkoutChannel = channel({
  name: (checkoutRequestId: string) => `checkout:${checkoutRequestId}`,
  topics: { status: { schema: CheckoutStatusMessageSchema } },
})

/**
 * Statuses that end the customer's wait.
 *
 * `PENDING` and `PROCESSING` are not pushed at all: they tell the browser
 * nothing it did not already know from the enqueue response, and publishing
 * them would put the intermediate states of every retry on the wire.
 */
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])

export const isTerminalCheckoutStatus = (status: string): boolean =>
  TERMINAL_STATUSES.has(status)

/**
 * Announce a settled checkout request.
 *
 * Bounded and non-throwing on purpose: this runs immediately after the status
 * write the customer's order actually depends on, so neither a slow Realtime
 * API nor a failed publish may turn a completed checkout into a failed
 * request. The bridge's own re-read is the safety net for a lost message.
 */
export const publishCheckoutStatus = async (
  message: CheckoutStatusMessage
): Promise<boolean> => {
  if (!isInngestConfigured()) return false
  if (!isTerminalCheckoutStatus(message.status)) return false

  try {
    await raceWithTimeout(
      inngest.realtime.publish(
        checkoutChannel(message.checkoutRequestId).status,
        message
      )
    )
    return true
  } catch (error) {
    logError({
      error,
      context: 'checkout_realtime_publish_failed',
      additionalInfo: {
        checkoutRequestId: message.checkoutRequestId,
        status: message.status,
      },
    })
    return false
  }
}

/** Handle returned by {@link subscribeToCheckoutStatus}. */
export interface CheckoutStatusSubscription {
  close(reason?: string): void
}

/**
 * Subscribe to one checkout request's settlement, server-side.
 *
 * Returns `null` when Realtime is unavailable — either unconfigured or the
 * connection failed — so the caller can fall back to its own re-reads instead
 * of failing the request.
 */
export const subscribeToCheckoutStatus = async ({
  checkoutRequestId,
  onMessage,
}: {
  checkoutRequestId: string
  onMessage: (message: CheckoutStatusMessage) => void
}): Promise<CheckoutStatusSubscription | null> => {
  if (!isInngestConfigured()) return null

  try {
    return await inngest.realtime.subscribe({
      channel: checkoutChannel(checkoutRequestId),
      topics: ['status'],
      onMessage: (raw) => {
        const parsed = CheckoutStatusMessageSchema.safeParse(raw.data)
        // A message that fails the schema is from an older or newer deploy;
        // dropping it leaves the caller on its re-read path rather than
        // handing the browser a malformed status.
        if (parsed.success) onMessage(parsed.data)
      },
      onError: (error) => {
        logError({
          error,
          context: 'checkout_realtime_subscribe_error',
          additionalInfo: { checkoutRequestId },
        })
      },
    })
  } catch (error) {
    logError({
      error,
      context: 'checkout_realtime_subscribe_failed',
      additionalInfo: { checkoutRequestId },
    })
    return null
  }
}
