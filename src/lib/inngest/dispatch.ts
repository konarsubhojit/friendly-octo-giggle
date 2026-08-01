/**
 * The single publish seam every workflow producer goes through.
 *
 * Producers state a fact ("this order exists") and nothing more; what happens
 * next is decided by the functions subscribed to that fact. Routing every
 * publish through here is what makes that uniform:
 *
 *  - Publishing is bounded, so a slow Inngest API can never become the latency
 *    of a user-facing request.
 *  - When Inngest is not configured, or the publish fails, the caller's
 *    fallback runs instead. Without it a missing `INNGEST_EVENT_KEY` would
 *    silently swallow every transactional email.
 *  - Failures are logged one way, so "did this event get published?" is a
 *    single log query rather than five bespoke ones.
 */

import { inngest, isInngestConfigured } from '@/lib/inngest/client'
import { logError } from '@/lib/logger'

type WorkflowEventPayload = Parameters<typeof inngest.send>[0]

/**
 * Budget for a publish attempt.
 *
 * Publishes happen on request paths, so the wait must stay well inside the
 * route's own budget: the fallback is what actually delivers the work, and it
 * needs time left to run.
 */
export const INNGEST_PUBLISH_TIMEOUT_MS = 5_000

export class InngestPublishTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Inngest publish did not complete within ${timeoutMs}ms`)
    this.name = 'InngestPublishTimeoutError'
  }
}

/**
 * Publish, giving up on the *wait* after a fixed budget.
 *
 * A publish that lands after the timeout is not cancelled and is harmless:
 * every consumer is idempotent, so the late event either does nothing or does
 * the same thing the fallback already did. `Promise.race` subscribes to the
 * publish promise first, so a late rejection is already handled and cannot
 * surface as an unhandled rejection.
 */
export const publishWithTimeout = async (
  payload: WorkflowEventPayload,
  timeoutMs: number = INNGEST_PUBLISH_TIMEOUT_MS
): Promise<void> => {
  const publish = inngest.send(payload).then(() => undefined)

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new InngestPublishTimeoutError(timeoutMs)),
      timeoutMs
    )
  })

  try {
    await Promise.race([publish, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export interface WorkflowDispatchOptions {
  /** Created event payload, built with the event type's `create()`. */
  readonly event: WorkflowEventPayload
  /** Log context used when the publish fails. */
  readonly context: string
  /** Structured fields attached to the failure log. */
  readonly details?: Record<string, unknown>
  /**
   * Runs when the event could not be published — either because Inngest is
   * unconfigured or because the publish failed. Omit only when losing the
   * work is genuinely acceptable.
   */
  readonly fallback?: () => Promise<void>
  readonly timeoutMs?: number
}

/** How the work was actually handed off, returned for logging and tests. */
export type WorkflowDispatchResult = 'published' | 'fallback' | 'dropped'

/**
 * Publish a workflow event, falling back to inline handling when it fails.
 *
 * The fallback's own failure is logged rather than rethrown: producers call
 * this after the state change they care about is already durable, so throwing
 * here would fail a request whose primary work has already succeeded.
 */
export const dispatchWorkflowEvent = async ({
  event,
  context,
  details,
  fallback,
  timeoutMs,
}: WorkflowDispatchOptions): Promise<WorkflowDispatchResult> => {
  if (isInngestConfigured()) {
    try {
      await publishWithTimeout(event, timeoutMs)
      return 'published'
    } catch (error) {
      logError({ error, context, additionalInfo: details })
    }
  }

  if (!fallback) {
    return 'dropped'
  }

  try {
    await fallback()
  } catch (fallbackError) {
    logError({
      error: fallbackError,
      context: `${context}_fallback_failed`,
      additionalInfo: details,
    })
  }

  return 'fallback'
}
