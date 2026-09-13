/**
 * App-owned deferred-work contract.
 *
 * Every call site that needs to keep working after a response has been sent
 * depends on this interface — never on `@vercel/functions` directly. Adapters
 * for Vercel's Fluid Compute `waitUntil` and a plain long-lived Node process
 * live alongside this file.
 */

import type { DeferredProvider } from '@/lib/providers/types'

export interface DeferredRunner {
  readonly provider: DeferredProvider
  /**
   * Keep `promise` running after the response has been sent.
   *
   * Implementations must never let a rejection escape as an unhandled
   * rejection: a failure to schedule or complete deferred work is a logged
   * event, not a process-level error.
   */
  waitUntil(promise: Promise<unknown>): void
}
