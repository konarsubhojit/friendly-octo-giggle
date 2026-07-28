import { Inngest } from 'inngest'
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
 * The event key is optional so the app still boots (and falls back to the
 * Vercel Queue) in environments where Inngest is not configured yet.
 */
export const inngest = new Inngest({
  id: INNGEST_APP_ID,
  eventKey: env.INNGEST_EVENT_KEY,
})

/**
 * Whether Inngest is wired up for this environment.
 *
 * Used to pick the checkout orchestrator: with a key present, checkout work is
 * published as an Inngest event; without one it keeps using the Vercel Queue.
 */
export const isInngestConfigured = (): boolean =>
  Boolean(env.INNGEST_EVENT_KEY?.trim())
