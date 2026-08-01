import { eventType } from 'inngest'
import { z } from 'zod'

/**
 * A newly registered account needs its address confirmed.
 *
 * The tokenised URL is built by the publisher (it owns token minting) and
 * carried on the event. It is single-use and short-lived, so it is safe to
 * hold for the lifetime of a run but must never be used as a session id.
 */
export const emailVerificationRequested = eventType(
  'auth/email-verification.requested',
  {
    schema: z.object({
      to: z.email(),
      customerName: z.string().min(1),
      verifyUrl: z.url(),
      /** Distinguishes one issued token from the next for idempotency. */
      requestId: z.string().min(1),
    }),
  }
)

/** A password reset was requested for an existing account. */
export const passwordResetRequested = eventType(
  'auth/password-reset.requested',
  {
    schema: z.object({
      to: z.email(),
      customerName: z.string().min(1),
      resetUrl: z.url(),
      requestId: z.string().min(1),
    }),
  }
)
