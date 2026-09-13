/**
 * Vercel Fluid Compute adapter for the deferred-work contract.
 *
 * Delegates to `@vercel/functions`' `waitUntil`, which keeps the invocation
 * alive after the response streams so the promise can finish. Imported
 * lazily (`require`, mirroring `src/lib/cache/index.ts`'s adapter loading) so
 * the package is never pulled into a bundle running off Vercel.
 */

import type { DeferredRunner } from './types'

export const createVercelDeferredRunner = (): DeferredRunner => ({
  provider: 'vercel',

  waitUntil(promise: Promise<unknown>): void {
    const { waitUntil } =
      require('@vercel/functions') as typeof import('@vercel/functions')
    waitUntil(promise)
  },
})
