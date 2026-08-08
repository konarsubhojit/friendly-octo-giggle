/**
 * Shared score names and emitters.
 *
 * Scores are how a run reports *what it achieved*, as opposed to whether it
 * threw. A checkout run that skips because the request was already processed
 * is a success by Inngest's reckoning but produced no order; without a score
 * that distinction is invisible on the dashboard.
 *
 * Names are centralised because a score is only useful if it is spelled the
 * same way by every function that emits it — the dashboard aggregates on the
 * literal string.
 *
 * `step.score()` is contributed by `scoreMiddleware()`, registered on the
 * shared client. Values must be a finite number or a boolean; anything else is
 * rejected by the platform.
 */

export const SCORE_NAMES = {
  /** Quality — did the checkout pipeline actually produce an order? */
  checkoutCompleted: 'checkout-completed',
  /** Quality — did the run stop because stock moved under the customer? */
  stockConflict: 'stock-conflict',
  /** Performance — wall-clock duration of the checkout pipeline. */
  checkoutLatencyMs: 'checkout-latency-ms',
  /** Performance — was the customer-visible checkout SLO met? */
  checkoutWithinSlo: 'checkout-within-slo',
  /** Quality — did the email reach a provider without landing in retries? */
  emailDeliveredFirstAttempt: 'email-delivered-first-attempt',
  /** Tool use — did the primary email provider fail over to the fallback? */
  emailProviderFallbackUsed: 'email-provider-fallback-used',
  /** Quality — did a nightly retry finally clear a stuck email? */
  emailRetryRecovered: 'email-retry-recovered',
  /** Quality — did the abandoned-cart reminder lead to an order? */
  abandonedCartRecovered: 'abandoned-cart-recovered',
  /** Tool use — did the upstream FX provider answer on the first attempt? */
  exchangeRatesRefreshed: 'exchange-rates-refreshed',
  /** Tool use — did the payment gateway settle without needing a retry? */
  paymentVerifiedFirstAttempt: 'payment-verified-first-attempt',
  /** Quality — did the expiry sweep clear its backlog inside one run? */
  reservationExpirySweepDrained: 'reservation-expiry-sweep-drained',
  /** Quality — did the order reach the Redis search mirror? */
  orderIndexed: 'order-indexed',
} as const

/**
 * The slice of Inngest's step tooling the score helpers need.
 *
 * Declared structurally so function bodies stay testable against a plain fake
 * rather than a reconstructed execution context.
 */
export interface ScoringStep {
  score(
    memoizationId: string,
    score: { name: string; value: number | boolean }
  ): Promise<unknown>
}

/**
 * Customer-visible checkout budget.
 *
 * The payment page waits — now on a push — until the order exists, so this is
 * the threshold that decides whether that wait feels instant. Scoring against
 * it keeps the settlement latency the customer actually sees on the record.
 */
export const CHECKOUT_SLO_MS = 10_000

/** Emit the two delivery scores every transactional email function shares. */
export const scoreEmailDelivery = async (
  step: ScoringStep,
  result: {
    readonly emailSuppressed: boolean
    readonly emailDelivered: boolean
    readonly usedFallbackProvider: boolean
  }
): Promise<void> => {
  // A suppressed email is a correct outcome, not a delivery — scoring it as a
  // success would quietly inflate the delivery rate with people who opted out.
  if (result.emailSuppressed) return

  await step.score('score-email-delivered', {
    name: SCORE_NAMES.emailDeliveredFirstAttempt,
    value: result.emailDelivered,
  })
  await step.score('score-email-fallback', {
    name: SCORE_NAMES.emailProviderFallbackUsed,
    value: result.usedFallbackProvider,
  })
}
