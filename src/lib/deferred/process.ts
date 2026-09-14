/**
 * Plain-process adapter for the deferred-work contract.
 *
 * On a long-lived Node server the process is never frozen after the response
 * is sent, so "deferred" work here is simply the promise running inline —
 * there is nothing to hand off to a platform. A rejection is caught and
 * logged instead of being left to become an unhandled rejection, which would
 * otherwise be able to crash the process depending on Node's configuration.
 */

import { logError } from '@/lib/logger'
import type { DeferredRunner } from './types'

export const createProcessDeferredRunner = (): DeferredRunner => ({
  provider: 'process',

  waitUntil(promise: Promise<unknown>): void {
    promise.catch((error: unknown) => {
      logError({
        error,
        context: 'deferred_work_failed',
      })
    })
  },
})
