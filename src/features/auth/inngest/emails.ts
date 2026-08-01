import { inngest } from '@/lib/inngest/client'
import {
  emailVerificationRequested,
  passwordResetRequested,
} from '@/features/auth/inngest/events'
import {
  createEmailVerificationEmail,
  createPasswordResetEmail,
  type AuthEmailMessage,
} from '@/features/auth/inngest/templates'
import { deliverEmail } from '@/lib/email'
import { SCORE_NAMES } from '@/lib/inngest/scores'
import { logError } from '@/lib/logger'

/**
 * Both of these gate a user out of their account until they arrive, so they get
 * one more attempt than the order emails.
 */
export const AUTH_EMAIL_RETRIES = 4

const buildMessage = (
  data:
    | { verifyUrl: string; customerName: string }
    | { resetUrl: string; customerName: string }
): AuthEmailMessage =>
  'verifyUrl' in data
    ? createEmailVerificationEmail({
        customerName: data.customerName,
        verifyUrl: data.verifyUrl,
      })
    : createPasswordResetEmail({
        customerName: data.customerName,
        resetUrl: data.resetUrl,
      })

/**
 * Account-security emails: address verification and password reset.
 *
 * Both are handled by one function because they are the same operation with
 * different copy, and both are latency-critical for conversion — the publisher
 * now makes a single `inngest.send` instead of a QStash publish that had to
 * come back in as a second inbound HTTP request.
 *
 * These deliberately bypass the notification-preference check: a user cannot
 * opt out of the email that lets them into their own account.
 */
export const sendAuthEmailFunction = inngest.createFunction(
  {
    id: 'send-auth-email',
    name: 'Send account security email',
    triggers: [emailVerificationRequested, passwordResetRequested],
    retries: AUTH_EMAIL_RETRIES,
    // Keyed on the issued token's request id, so a duplicate publish collapses
    // but a genuine second request (a user clicking "resend") still sends.
    idempotency: 'event.name + "-" + event.data.requestId',
    onFailure: ({ event, error }) => {
      logError({
        error,
        context: 'inngest_auth_email_retries_exhausted',
        additionalInfo: {
          eventName: event.data.event.name,
          requestId: event.data.event.data.requestId,
        },
      })
      return Promise.resolve()
    },
  },
  async ({ event, step }) => {
    const message = buildMessage(event.data)

    const result = await step.run('deliver-auth-email', () =>
      deliverEmail({
        to: event.data.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      })
    )

    await step.score('score-auth-email-fallback', {
      name: SCORE_NAMES.emailProviderFallbackUsed,
      value: result.usedFallbackProvider,
    })

    return { requestId: event.data.requestId, provider: result.provider }
  }
)
