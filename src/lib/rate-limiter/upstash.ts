/**
 * Upstash rate limiter adapter — edge-safe.
 *
 * Uses STATIC imports of `@upstash/ratelimit` and `@upstash/redis` so the
 * module can be bundled for the Edge runtime (no `require()` calls).
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { RateLimiter, RateLimitResult } from './types'

export class UpstashRateLimiter implements RateLimiter {
  private inner: Ratelimit

  constructor(opts: {
    url: string
    token: string
    maxRequests: number
    windowSeconds: number
    prefix: string
  }) {
    this.inner = new Ratelimit({
      redis: new Redis({ url: opts.url, token: opts.token }),
      limiter: Ratelimit.slidingWindow(
        opts.maxRequests,
        `${opts.windowSeconds} s`
      ),
      prefix: opts.prefix,
    })
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const r = await this.inner.limit(identifier)
    return {
      success: r.success,
      limit: r.limit,
      remaining: r.remaining,
      reset: r.reset,
    }
  }
}
