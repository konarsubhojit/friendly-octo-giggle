/**
 * Vercel Fluid Compute adapter for the deferred-work contract.
 *
 * Delegates to `@vercel/functions`' `waitUntil`, which keeps the invocation
 * alive after the response streams so the promise can finish. Imported
 * lazily (`require`, mirroring `src/lib/cache/index.ts`'s adapter loading) so
 * the package is never pulled into a bundle running off Vercel.
 *
 * The vendor `waitUntil` can throw synchronously when called outside a valid
 * Fluid Compute invocation context. Rather than let that propagate to the
 * caller uncaught, fall back to running the promise inline (same as the
 * `process` adapter) so the chain still runs and the failure is logged
 * instead of lost.
 */

import { logError } from '@/lib/logger'
import type { DeferredRunner } from './types'

export const createVercelDeferredRunner = (): DeferredRunner => ({
  provider: 'vercel',

  waitUntil(promise: Promise<unknown>): void {
    try {
      const { waitUntil } =
        require('@vercel/functions') as typeof import('@vercel/functions')
      waitUntil(promise)
    } catch (error: unknown) {
      logError({
        error,
        context: 'deferred_work_failed',
      })
      Promise.resolve(promise).catch((promiseError: unknown) => {
        logError({
          error: promiseError,
          context: 'deferred_work_failed',
        })
      })
    }
  },
})
