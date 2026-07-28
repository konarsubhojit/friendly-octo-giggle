import { NonRetriableError } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { CheckoutQueueMessageSchema } from '@/features/cart/validations'
import { checkoutRequestCreated } from '@/features/cart/inngest/events'
import {
  claimCheckoutRequest,
  createOrderForCheckoutRequest,
  preflightCheckoutRequest,
  recordCheckoutProcessingFailure,
  recoverCheckoutRequestAfterRetryExhaustion,
} from '@/features/cart/services/checkout-service'
import { logError } from '@/lib/logger'

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
export interface CheckoutStepRunner {
  run<T>(id: string, handler: () => T | Promise<T>): Promise<T>
}

/** Outcome of a durable run, returned for run history and tests. */
export type CheckoutRunResult =
  | {
      readonly checkoutRequestId: string
      readonly outcome: 'skipped'
      readonly reason: string
    }
  | { readonly checkoutRequestId: string; readonly outcome: 'already-processing' }
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
}: {
  event: { data: unknown }
  step: CheckoutStepRunner
}): Promise<CheckoutRunResult> => {
  const { checkoutRequestId } = CheckoutQueueMessageSchema.parse(event.data)

  // Step 1 — idempotency guard. Returns a narrow, JSON-safe projection so the
  // checkpointed value never carries non-serializable row fields.
  const preflight = await step.run('preflight-checkout-request', async () => {
    const result = await preflightCheckoutRequest(checkoutRequestId)
    return result.action === 'process'
      ? { action: 'process' as const }
      : { action: 'skip' as const, reason: result.reason }
  })

  if (preflight.action === 'skip') {
    return { checkoutRequestId, outcome: 'skipped', reason: preflight.reason }
  }

  // Step 2 — compare-and-swap claim. Memoized, so a retry of a later step
  // never re-claims and never depends on the stale-claim window.
  const claimed = await step.run('claim-checkout-request', () =>
    claimCheckoutRequest(checkoutRequestId)
  )

  if (!claimed) {
    return { checkoutRequestId, outcome: 'already-processing' }
  }

  // Step 3 — verify payment and persist the order atomically.
  const orderId = await step.run('create-order', async () => {
    try {
      return await createOrderForCheckoutRequest(checkoutRequestId)
    } catch (error) {
      const { terminal } = await recordCheckoutProcessingFailure(
        checkoutRequestId,
        error
      )

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
    logError({
      error,
      context: 'inngest_checkout_failure_without_request_id',
    })
    return
  }

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
