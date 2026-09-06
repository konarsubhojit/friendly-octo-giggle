/**
 * Edge-safe rate limiter factory.
 *
 * Only allows Upstash (HTTP) or in-memory — never imports Node TCP Redis.
 * Used from `proxy.ts` and any Next.js edge middleware.
 *
 * Import chain:  proxy.ts → rate-limiter/edge.ts → upstash.ts / memory.ts
 *   (all edge-compatible, zero `require()`, zero Node-only imports)
 */

import type { RateLimiter, RateLimiterConfig } from './types'
import { UpstashRateLimiter } from './upstash'
import { InMemoryRateLimiter } from './memory'

export type { RateLimiter, RateLimitResult, RateLimiterConfig } from './types'
export { InMemoryRateLimiter } from './memory'

/**
 * Create an edge-safe rate limiter (Upstash or in-memory fallback).
 */
export function createEdgeRateLimiter(
  config: RateLimiterConfig,
  upstash?: { url: string; token: string }
): RateLimiter {
  if (upstash?.url && upstash?.token) {
    return new UpstashRateLimiter({
      url: upstash.url,
      token: upstash.token,
      maxRequests: config.maxRequests,
      windowSeconds: config.windowSeconds ?? 60,
      prefix: config.prefix,
    })
  }
  return new InMemoryRateLimiter(
    config.maxRequests,
    (config.windowSeconds ?? 60) * 1000
  )
}
