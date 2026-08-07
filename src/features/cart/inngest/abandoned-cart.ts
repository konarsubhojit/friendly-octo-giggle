import { cron, experiment } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { abandonedCartReminderDue } from '@/features/cart/inngest/events.abandoned'
import { cartRecoveryScorer } from '@/features/cart/inngest/scorers'
import {
  deliverAbandonedCartReminder,
  findAbandonedCartCandidates,
} from '@/features/cart/services/abandoned-cart-service'
import { cartSession } from '@/lib/inngest/sessions'
import { logBusinessEvent, logError } from '@/lib/logger'

/**
 * Marketing email, so a shorter retry tail than transactional mail: a reminder
 * that lands hours late has largely lost its point, and the cart is picked up
 * again by the next nightly scan.
 */
export const ABANDONED_CART_RETRIES = 2

/**
 * Share of users who receive the scarcity-led copy.
 *
 * Deliberately small: this is a live test on real customers, and the control
 * arm is the copy that is already known to be inoffensive.
 */
export const URGENCY_VARIANT_WEIGHT = 20

/**
 * Nightly scan for carts due a recovery reminder.
 *
 * The route this replaces sent every reminder inside one invocation with two
 * `Promise.allSettled` calls, capped at 50 to stop the invocation timing out.
 * Fanning out one event per cart removes the cap: send rate is now governed by
 * the reminder function's `throttle`, and a cart that fails is retried on its
 * own rather than lost with the rest of the batch.
 */
export const scanAbandonedCartsFunction = inngest.createFunction(
  {
    id: 'scan-abandoned-carts',
    name: 'Scan for abandoned carts',
    triggers: [cron('0 10 * * *')],
    retries: 2,
  },
  async ({ step }) => {
    const candidates = await step.run('find-abandoned-carts', () =>
      findAbandonedCartCandidates()
    )

    if (candidates.length === 0) {
      logBusinessEvent({
        event: 'cron_abandoned_cart_skip',
        details: { reason: 'no_candidates' },
        success: true,
      })
      return { queued: 0 }
    }

    await step.sendEvent(
      'queue-abandoned-cart-reminders',
      candidates.map((candidate) =>
        abandonedCartReminderDue.create(candidate, {
          // Stitches reminder 1, reminder 2 and the recovery scorer for a cart
          // into one session, days apart.
          meta: { sessions: cartSession(candidate.cartId) },
        })
      )
    )

    logBusinessEvent({
      event: 'cron_abandoned_cart_queued',
      details: { total: candidates.length },
      success: true,
    })

    return { queued: candidates.length }
  }
)

/**
 * Send one recovery reminder, as one of two copy variants.
 *
 * This is the safest place in the estate to run a live experiment: no payment,
 * no stock and no order row is touched, the per-cart reminder cap makes a
 * double-send impossible, and the outcome that matters — did the cart convert?
 * — is already measurable.
 *
 * `experiment.bucket(userId)` rather than `experiment.weighted()` because the
 * assignment has to be *stable per user*: someone who gets the gentle copy at
 * 24h must not get the urgency copy at 72h, or neither arm means anything.
 */
export const sendAbandonedCartReminderFunction = inngest.createFunction(
  {
    id: 'send-abandoned-cart-reminder',
    name: 'Send abandoned cart reminder',
    triggers: [abandonedCartReminderDue],
    retries: ABANDONED_CART_RETRIES,
    // One reminder per cart per number, however many times the scan queues it.
    idempotency: 'event.data.cartId + "-" + event.data.reminderNumber',
    // Marketing volume must never crowd out transactional mail on the shared
    // provider quota.
    concurrency: { limit: 5 },
    throttle: { limit: 60, period: '1m' },
    onFailure: ({ event, error }) => {
      logError({
        error,
        context: 'inngest_abandoned_cart_reminder_failed',
        additionalInfo: {
          cartId: event.data.event.data.cartId,
          reminderNumber: event.data.event.data.reminderNumber,
        },
      })
      return Promise.resolve()
    },
  },
  async ({ event, step, group, defer }) => {
    const { cartId, userId, reminderNumber } = event.data

    const { result, experimentRef } = await group.experiment('reminder-copy', {
      variants: {
        gentle: () =>
          step.run('send-gentle-reminder', () =>
            deliverAbandonedCartReminder({
              cartId,
              userId,
              reminderNumber,
              tone: 'gentle',
            })
          ),
        urgency: () =>
          step.run('send-urgency-reminder', () =>
            deliverAbandonedCartReminder({
              cartId,
              userId,
              reminderNumber,
              tone: 'urgency',
            })
          ),
      },
      select: experiment.bucket(userId, {
        weights: {
          gentle: 100 - URGENCY_VARIANT_WEIGHT,
          urgency: URGENCY_VARIANT_WEIGHT,
        },
      }),
    })

    if (!result.sent) {
      return { cartId, reminderNumber, sent: false, reason: result.reason }
    }

    // The outcome arrives days from now, so it is scored by a separate run
    // that writes back onto this one — and onto the variant that was chosen.
    defer('score-cart-recovery', {
      function: cartRecoveryScorer,
      data: { cartId, userId },
      experiment: experimentRef,
    })

    return { cartId, reminderNumber, sent: true }
  }
)
