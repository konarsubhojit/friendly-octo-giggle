import { NonRetriableError } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { CheckoutQueueMessageSchema } from '@/features/cart/validations'
import { checkoutRequestCreated } from '@/features/cart/inngest/events'
import type { CheckoutSkipReason } from '@/features/cart/services/checkout-service'
import {
  CHECKOUT_SLO_MS,
  SCORE_NAMES,
  type ScoringStep,
} from '@/lib/inngest/scores'

/**
 * Retries after the first attempt. Five total attempts keeps parity with the
 * Vercel Queue consumer's `MAX_CHECKOUT_CONSUMER_ATTEMPTS`.
 */
export const CHECKOUT_FUNCTION_RETRIES = 4

/**
 * The subset of Inngest's step tooling this pipeline needs.
 *
 * Declared structurally so the pipeline body can be run against a plain fake in
 * tests without reconstructing an Inngest execution context.
 */
export interface CheckoutStepRunner extends ScoringStep {
  run<T>(id: string, handler: () => T | Promise<T>): Promise<T>
}

/**
 * Stock moving under a customer mid-checkout surfaces as a 409.
 *
 * Scored separately from other failures because it is not a defect in this
 * pipeline: a rising rate means the reservation window between "added to cart"
 * and "payment settled" is too wide, which is a product decision rather than a
 * bug to chase in the run logs.
 */
const isStockConflict = async (error: unknown): Promise<boolean> => {
  const { isOrderRequestError } =
    await import('@/features/orders/services/order-service')
  return isOrderRequestError(error) && error.status === 409
}

const logCheckoutError = async (
  error: unknown,
  context: string
): Promise<void> => {
  const { logError } = await import('@/lib/logger')
  logError({ error, context })
}

/** Outcome of a durable run, returned for run history and tests. */
export type CheckoutRunResult =
  | {
      readonly checkoutRequestId: string
      readonly outcome: 'skipped'
      readonly reason: CheckoutSkipReason
    }
  | {
      readonly checkoutRequestId: string
      readonly outcome: 'already-processing'
      readonly reason: CheckoutSkipReason
    }
  | {
      readonly checkoutRequestId: string
      readonly outcome: 'completed'
      readonly orderId: string
    }

/**
 * Durable pipeline body.
 *
 * Exported separately from the function definition so it can be exercised
 * directly in tests with a fake step runner.
 */
export const runCheckoutRequestSteps = async ({
  event,
  step,
  attempt = 0,
}: {
  event: { data: unknown }
  step: CheckoutStepRunner
  /** Zero-based retry counter supplied by Inngest. */
  attempt?: number
}): Promise<CheckoutRunResult> => {
  const { checkoutRequestId } = CheckoutQueueMessageSchema.parse(event.data)

  // Memoized so the elapsed time measures the whole durable pipeline, not just
  // the final attempt: a retry replays this step's checkpointed value rather
  // than resetting the clock, which is exactly the number the customer feels.
  const startedAt = await step.run('mark-start', () => Date.now())

  // Step 1 — idempotency guard. Returns a narrow, JSON-safe projection so the
  // checkpointed value never carries non-serializable row fields.
  const preflight = await step.run('preflight-checkout-request', async () => {
    const { preflightCheckoutRequest } =
      await import('@/features/cart/services/checkout-service')
    const result = await preflightCheckoutRequest(checkoutRequestId)
    return result.action === 'process'
      ? { action: 'process' as const }
      : { action: 'skip' as const, reason: result.reason }
  })

  if (preflight.action === 'skip') {
    // A skip is a *successful* run by Inngest's reckoning but produced no
    // order. Without this score the dashboard cannot tell "nothing failed"
    // apart from "nothing happened", which is how a regression that skips
    // every request would stay invisible.
    await step.score('score-outcome', {
      name: SCORE_NAMES.checkoutCompleted,
      value: false,
    })
    return { checkoutRequestId, outcome: 'skipped', reason: preflight.reason }
  }

  // Step 2 — compare-and-swap claim. Memoized, so a retry of a later step
  // never re-claims and never depends on the stale-claim window.
  const claim = await step.run('claim-checkout-request', async () => {
    const { claimCheckoutRequest, resolveCheckoutSettlement } =
      await import('@/features/cart/services/checkout-service')
    if (await claimCheckoutRequest(checkoutRequestId)) {
      return { claimed: true as const }
    }

    // A failed claim is ambiguous: either a peer trigger owns the request, or
    // this run already claimed it on an attempt that died before its
    // checkpoint persisted. Only a settled request is safe to walk away from
    // — otherwise nothing else would ever pick the request up, because the
    // queue never received it and the webhook refuses to reprocess
    // `PROCESSING`.
    const settlement = await resolveCheckoutSettlement(checkoutRequestId)
    if (settlement.settled) {
      return { claimed: false as const, reason: settlement.reason }
    }

    throw new Error(
      `Checkout request ${checkoutRequestId} is claimed but unsettled; retrying until the claim goes stale`
    )
  })

  if (!claim.claimed) {
    await step.score('score-outcome', {
      name: SCORE_NAMES.checkoutCompleted,
      value: false,
    })
    return {
      checkoutRequestId,
      outcome: 'already-processing',
      reason: claim.reason,
    }
  }

  // Step 3 — verify payment and persist the order atomically.
  const orderId = await step.run('create-order', async () => {
    const {
      createOrderForCheckoutRequest,
      recordCheckoutProcessingFailure,
    } = await import('@/features/cart/services/checkout-service')
    try {
      return await createOrderForCheckoutRequest(checkoutRequestId)
    } catch (error) {
      const { terminal } = await recordCheckoutProcessingFailure(
        checkoutRequestId,
        error
      )

      // A live score rather than `step.score()`: this path always ends in a
      // throw, so a memoized score placed after the step would never be
      // reached. Written from inside the step so it lands on that step's
      // trace, and swallowed on failure so telemetry can never be the reason
      // a checkout error is reported as something else.
      if (await isStockConflict(error)) {
        await inngest
          .score({ name: SCORE_NAMES.stockConflict, value: true })
          .catch((scoreError: unknown) =>
            logCheckoutError(scoreError, 'checkout_score_failed')
          )
      }

      if (terminal) {
        // Client-side failures never succeed on a retry.
        throw new NonRetriableError(
          error instanceof Error ? error.message : 'Checkout request failed',
          { cause: error }
        )
      }

      throw error
    }
  })

  await step.score('score-outcome', {
    name: SCORE_NAMES.checkoutCompleted,
    value: true,
  })
  await step.score('score-stock-conflict', {
    name: SCORE_NAMES.stockConflict,
    value: false,
  })
  // Isolates gateway flakiness from defects in this pipeline: a retry here
  // means the payment provider needed a second ask, not that the code is
  // wrong.
  await step.score('score-payment-first-attempt', {
    name: SCORE_NAMES.paymentVerifiedFirstAttempt,
    value: attempt === 0,
  })

  // Feeds the same intent as `ORDER_PROCESSING_BUCKETS_MS` in `lib/metrics`,
  // but survives a cold start and is queryable per-deploy. The boolean is the
  // one that answers "can the client-side completion poll be replaced with a
  // push yet?" without eyeballing a histogram.
  const elapsedMs = Date.now() - startedAt
  await step.score('score-latency', {
    name: SCORE_NAMES.checkoutLatencyMs,
    value: elapsedMs,
  })
  await step.score('score-slo', {
    name: SCORE_NAMES.checkoutWithinSlo,
    value: elapsedMs <= CHECKOUT_SLO_MS,
  })

  return { checkoutRequestId, orderId, outcome: 'completed' }
}

/**
 * Terminal handler, invoked once every retry is exhausted.
 *
 * Mirrors the Vercel Queue consumer's `recoverCheckoutRequestAfterRetryExhaustion`
 * call so both orchestrators settle a dead request the same way.
 */
export const handleCheckoutRequestFailure = async ({
  originalEventData,
  error,
}: {
  originalEventData: unknown
  error: unknown
}): Promise<void> => {
  const parsed = CheckoutQueueMessageSchema.safeParse(originalEventData)

  if (!parsed.success) {
    await logCheckoutError(
      error,
      'inngest_checkout_failure_without_request_id'
    )
    return
  }

  const { recoverCheckoutRequestAfterRetryExhaustion } =
    await import('@/features/cart/services/checkout-service')
  await recoverCheckoutRequestAfterRetryExhaustion({
    checkoutRequestId: parsed.data.checkoutRequestId,
    deliveryCount: CHECKOUT_FUNCTION_RETRIES + 1,
    error,
  })
}

/**
 * Durable checkout processing.
 *
 * Each step is checkpointed independently, so an attempt that dies (a crash, or
 * the platform killing the invocation at `maxDuration`) resumes at the failed
 * step instead of restarting the pipeline — no step has to fit the whole
 * pipeline into one function budget, and a killed worker can no longer strand a
 * checkout request in `PROCESSING`.
 *
 * Payment verification and order persistence stay together inside the
 * order-creation step on purpose: splitting them would create a window where
 * money is confirmed but no order exists.
 */
export const processCheckoutRequestFunction = inngest.createFunction(
  {
    id: 'process-checkout-request',
    name: 'Process checkout request',
    triggers: [checkoutRequestCreated],
    retries: CHECKOUT_FUNCTION_RETRIES,
    // One run per checkout request at a time; duplicate publishes collapse.
    concurrency: { key: 'event.data.checkoutRequestId', limit: 1 },
    idempotency: 'event.data.checkoutRequestId',
    onFailure: ({ event, error }) =>
      handleCheckoutRequestFailure({
        originalEventData: event.data.event.data,
        error,
      }),
  },
  runCheckoutRequestSteps
)
