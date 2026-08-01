import { cron, eventType } from 'inngest'
import { z } from 'zod'
import { inngest } from '@/lib/inngest/client'
import {
  getRetriableFailedEmails,
  retryFailedEmail,
} from '@/lib/email/failed-emails'
import { SCORE_NAMES } from '@/lib/inngest/scores'
import { logBusinessEvent } from '@/lib/logger'

/** One stuck email, ready to be retried on its own run. */
export const emailDeliveryFailed = eventType('email/delivery.failed', {
  schema: z.object({
    failedEmailId: z.string().min(1),
    emailType: z.string().min(1),
    referenceId: z.string().min(1),
  }),
})

/**
 * Nightly sweep for emails that never made it out.
 *
 * The route this replaces mapped every retriable row into a single
 * `Promise.allSettled` inside one invocation: one slow provider stalled the
 * whole batch, and an invocation timeout dropped the remainder with no retry.
 * Fanning out one event per row makes each retry independently durable and
 * lets throughput be governed by the child function's concurrency limit
 * instead of by how many sends fit in a function budget.
 */
export const retryFailedEmailsFunction = inngest.createFunction(
  {
    id: 'retry-failed-emails',
    name: 'Retry failed emails',
    triggers: [cron('30 2 * * *')],
  },
  async ({ step }) => {
    const retriable = await step.run('load-retriable-emails', async () => {
      const rows = await getRetriableFailedEmails()
      return rows.map((row) => ({
        id: row.id,
        emailType: row.emailType,
        referenceId: row.referenceId,
      }))
    })

    if (retriable.length === 0) {
      logBusinessEvent({
        event: 'cron_retry_emails_skip',
        details: { reason: 'no_retriable_emails' },
        success: true,
      })
      return { queued: 0 }
    }

    await step.sendEvent(
      'queue-email-retries',
      retriable.map((row) =>
        emailDeliveryFailed.create({
          failedEmailId: row.id,
          emailType: row.emailType,
          referenceId: row.referenceId,
        })
      )
    )

    logBusinessEvent({
      event: 'cron_retry_emails_queued',
      details: { total: retriable.length },
      success: true,
    })

    return { queued: retriable.length }
  }
)

/**
 * Retry a single stuck email.
 *
 * `retries: 0` because `retryFailedEmail` maintains its own attempt counter and
 * error history in `failedEmails`; layering Inngest retries on top would inflate
 * that counter and burn through `MAX_CRON_RETRY_ATTEMPTS` in one night.
 */
export const retrySingleEmailFunction = inngest.createFunction(
  {
    id: 'retry-single-email',
    name: 'Retry a single failed email',
    triggers: [emailDeliveryFailed],
    retries: 0,
    // Keeps the nightly fan-out from stampeding the provider, which is what
    // caused the batch to stall in the first place.
    concurrency: { limit: 5 },
    throttle: { limit: 30, period: '1m' },
  },
  async ({ event, step }) => {
    const result = await step.run('retry-email', () =>
      retryFailedEmail(event.data.failedEmailId)
    )

    await step.score('score-retry-recovered', {
      name: SCORE_NAMES.emailRetryRecovered,
      value: result.success,
    })

    return result
  }
)
