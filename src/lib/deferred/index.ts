/**
 * Deferred-runner factory.
 *
 * Resolves the configured `DeferredProvider` and returns a singleton
 * `DeferredRunner`. All call sites that need to keep work running after a
 * response has been sent import `waitUntil` from here — never from
 * `@vercel/functions` directly.
 */

export type { DeferredRunner } from './types'

import { getProvider } from '@/lib/providers/resolution'
import { createProcessDeferredRunner } from './process'
import { createVercelDeferredRunner } from './vercel'
import type { DeferredRunner } from './types'

let singleton: DeferredRunner | null = null

/** Return the singleton deferred runner for the process. */
export const getDeferredRunner = (): DeferredRunner => {
  if (singleton) return singleton

  const provider = getProvider('deferred')
  singleton =
    provider === 'vercel'
      ? createVercelDeferredRunner()
      : createProcessDeferredRunner()

  return singleton
}

/** Convenience: keep `promise` running after the response has been sent. */
export const waitUntil = (promise: Promise<unknown>): void => {
  getDeferredRunner().waitUntil(promise)
}

/** Exposed for tests that need to swap the singleton. */
export const __resetDeferredRunnerForTests = (): void => {
  singleton = null
}
