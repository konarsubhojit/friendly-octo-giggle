/**
 * Rate limiter factory — provider-aware, server-only.
 *
 * Resolves `RATE_LIMIT_PROVIDER` via the standard provider resolution system
 * and returns the matching adapter:
 *
 *   - `upstash`  → UpstashRateLimiter (Upstash REST, edge-compatible)
 *   - `redis`    → NodeRedisRateLimiter (Lua eval on CacheClient, server-only)
 *   - `memory`   → InMemoryRateLimiter (per-process, no coordination)
 *
 * Server-side consumers (`rate-limit.ts`, auth services) import from here.
 * Edge consumers (`proxy.ts`) import from `./edge` instead.
 */

export type { RateLimiter, RateLimitResult, RateLimiterConfig } from './types'
export { InMemoryRateLimiter } from './memory'

import type { RateLimiter, RateLimiterConfig } from './types'
import { getProvider } from '@/lib/providers/resolution'
import { getCacheClient } from '@/lib/cache/index'
import { env } from '@/lib/env'
import { InMemoryRateLimiter } from './memory'

/**
 * Create a rate limiter backed by the resolved `RATE_LIMIT_PROVIDER`.
 *
 * Returns `null` only when the resolved provider requires credentials that
 * are missing (e.g. `RATE_LIMIT_PROVIDER=upstash` but no Upstash env vars).
 */
export function createRateLimiter(
  config: RateLimiterConfig
): RateLimiter | null {
  const provider = getProvider('rateLimit')
  const windowSeconds = config.windowSeconds ?? 60

  switch (provider) {
    case 'upstash': {
      const url = env.UPSTASH_REDIS_REST_URL
      const token = env.UPSTASH_REDIS_REST_TOKEN
      if (!url || !token) return null
      // Dynamic import would be async; lazy require is acceptable here because
      // this file is server-only (never imported from edge paths).
      const { UpstashRateLimiter } = require('./upstash') as typeof import('./upstash')
      return new UpstashRateLimiter({
        url,
        token,
        maxRequests: config.maxRequests,
        windowSeconds,
        prefix: config.prefix,
      })
    }

    case 'redis': {
      const client = getCacheClient()
      if (!client) return null
      const { NodeRedisRateLimiter } = require('./node-redis') as typeof import('./node-redis')
      return new NodeRedisRateLimiter(
        client,
        config.maxRequests,
        windowSeconds,
        config.prefix
      )
    }

    case 'memory':
    default:
      return new InMemoryRateLimiter(config.maxRequests, windowSeconds * 1000)
  }
}
