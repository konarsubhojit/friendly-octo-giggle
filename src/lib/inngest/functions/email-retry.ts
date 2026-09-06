import { cron, eventType } from 'inngest'
import { z } from 'zod'
import { inngest } from '@/lib/inngest/client'
import { SCORE_NAMES } from '@/lib/inngest/scores'
import type { FailedEmailRetryResult } from '@/lib/email/failed-emails'

export const EMAIL_RETRY_BATCH_SIZE = 10
const EMAIL_RETRY_PARALLELISM = 5

const failedEmailSchema = z.object({
  failedEmailId: z.string().min(1),
  emailType: z.string().min(1),
  referenceId: z.string().min(1),
})

/** A bounded group of stuck emails, ready for one child run. */
export const emailDeliveryFailed = eventType('email/delivery.failed', {
  // Retain the legacy single-row shape while already-queued events drain.
  schema: z.union([
    failedEmailSchema,
    z.object({
      emails: z.array(failedEmailSchema).min(1).max(EMAIL_RETRY_BATCH_SIZE),
    }),
  ]),
})

const chunksOf = <T>(values: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

/**
 * Nightly sweep for emails that never made it out.
 *
 * The route this replaces mapped every retriable row into a single
 * `Promise.allSettled` inside one invocation: one slow provider stalled the
 * whole batch, and an invocation timeout dropped the remainder with no retry.
 * Bounded events retain durable retry isolation without creating one function
 * run per row. Each child processes at most ten rows with bounded parallelism,
 * so one slow provider cannot stall the entire nightly backlog.
 */
export const retryFailedEmailsFunction = inngest.createFunction(
  {
    id: 'retry-failed-emails',
    name: 'Retry failed emails',
    triggers: [cron('30 2 * * *')],
  },
  async ({ step }) => {
    const retriable = await step.run('load-retriable-emails', async () => {
      const { getRetriableFailedEmails } =
        await import('@/lib/email/failed-emails')
      const rows = await getRetriableFailedEmails()
      return rows.map((row) => ({
        id: row.id,
        emailType: row.emailType,
        referenceId: row.referenceId,
      }))
    })

    if (retriable.length === 0) {
      const { logBusinessEvent } = await import('@/lib/logger')
      logBusinessEvent({
        event: 'cron_retry_emails_skip',
        details: { reason: 'no_retriable_emails' },
        success: true,
      })
      return { queued: 0 }
    }

    await step.sendEvent(
      'queue-email-retries',
      chunksOf(retriable, EMAIL_RETRY_BATCH_SIZE).map((batch) =>
        emailDeliveryFailed.create({
          emails: batch.map((row) => ({
            failedEmailId: row.id,
            emailType: row.emailType,
            referenceId: row.referenceId,
          })),
        })
      )
    )

    const { logBusinessEvent } = await import('@/lib/logger')
    logBusinessEvent({
      event: 'cron_retry_emails_queued',
      details: { total: retriable.length },
      success: true,
    })

    return { queued: retriable.length }
  }
)

/**
 * Retry one bounded batch of stuck emails.
 *
 * `retries: 0` because `retryFailedEmail` maintains its own attempt counter and
 * error history in `failedEmails`; layering Inngest retries on top would inflate
 * that counter and burn through `MAX_CRON_RETRY_ATTEMPTS` in one night.
 */
export const retrySingleEmailFunction = inngest.createFunction(
  {
    id: 'retry-single-email',
    name: 'Retry a batch of failed emails',
    triggers: [emailDeliveryFailed],
    retries: 0,
    // Bounds concurrent batch runs. Work inside each run is also capped at five.
    concurrency: { limit: 5 },
    // Governs batch starts rather than individual rows; the nightly loader is
    // independently capped, and each batch contains at most ten rows.
    throttle: { limit: 30, period: '1m' },
  },
  async ({ event, step }) => {
    const emails = 'emails' in event.data ? event.data.emails : [event.data]
    const stepId = 'emails' in event.data ? 'retry-email-batch' : 'retry-email'
    const stepResult: FailedEmailRetryResult | FailedEmailRetryResult[] =
      await step.run(stepId, async (): Promise<FailedEmailRetryResult[]> => {
        const { retryFailedEmail } = await import('@/lib/email/failed-emails')
        const settled: FailedEmailRetryResult[] = []
        for (const batch of chunksOf(emails, EMAIL_RETRY_PARALLELISM)) {
          const batchResults = await Promise.all(
            batch.map(async (email) => {
              try {
                return await retryFailedEmail(email.failedEmailId)
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : String(error)
                const { logError } = await import('@/lib/logger')
                logError({
                  error,
                  context: 'failed_email_batch_retry',
                  additionalInfo: { failedEmailId: email.failedEmailId },
                })
                return {
                  id: email.failedEmailId,
                  success: false,
                  error: message,
                }
              }
            })
          )
          settled.push(...batchResults)
        }
        return settled
      })
    const results = Array.isArray(stepResult) ? stepResult : [stepResult]

    const recovered = results.filter((result) => result.success).length
    await step.score('score-retry-recovered', {
      name: SCORE_NAMES.emailRetryRecovered,
      value: recovered / results.length,
    })

    return {
      attempted: results.length,
      recovered,
      results,
    }
  }
)
