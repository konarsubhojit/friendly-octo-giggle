import { Inngest } from 'inngest'
import { scoreMiddleware } from 'inngest/experimental'
import { env } from '@/lib/env'

/**
 * Inngest application id.
 *
 * Every function served from this app is namespaced by it, so changing it
 * orphans in-flight runs — treat it as a stable identifier.
 */
export const INNGEST_APP_ID = 'friendly-octo-giggle'

/**
 * Shared Inngest client.
 *
 * Both keys are read through the validated env module rather than left to the
 * library's ambient `process.env` lookup: the served functions run the money
 * path, so request-signature verification must use the same key the
 * `INNGEST_EVENT_KEY ⇒ INNGEST_SIGNING_KEY` refinement guarantees is present.
 *
 * The event key is optional so the app still boots in environments where
 * Inngest is not configured yet. Publishers degrade to their own inline
 * fallbacks in that case rather than dropping the work.
 *
 * `scoreMiddleware()` is what puts `step.score()` on the step tooling. Without
 * it registered here the tool is absent at runtime, so every function that
 * records an outcome depends on this middleware staying in place.
 */
export const inngest = new Inngest({
  id: INNGEST_APP_ID,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  middleware: [scoreMiddleware()],
})

/**
 * Whether Inngest is wired up for this environment.
 *
 * Gates both halves of the background runtime: with a key present, checkout
 * work is published as an Inngest event and settlements are announced over
 * Realtime; without one, checkout falls back to inline processing and the
 * checkout stream falls back to its own status re-reads.
 */
export const isInngestConfigured = (): boolean =>
  Boolean(env.INNGEST_EVENT_KEY?.trim())
