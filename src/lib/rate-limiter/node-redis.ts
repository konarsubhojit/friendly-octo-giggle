/**
 * Node Redis rate limiter — server-only, backed by CacheClient.
 *
 * Implements a fixed-window algorithm via an atomic Lua script on the
 * app-owned `CacheClient`. The window is `windowSeconds` (default 60 s).
 *
 * NEVER import this file from edge/middleware paths — it uses `CacheClient`
 * which may resolve to a Node TCP Redis adapter.
 */

import type { CacheClient } from '@/lib/cache/index'
import type { RateLimiter, RateLimitResult } from './types'

/**
 * Lua script: fixed-window increment + auto-expire.
 *
 * KEYS[1]  — the rate-limit bucket key (e.g. `rl:general:ip:1.2.3.4`)
 * ARGV[1]  — max requests (limit)
 * ARGV[2]  — window TTL in seconds
 *
 * Returns:  { current count, ttl remaining (seconds) }
 */
const FIXED_WINDOW_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = tonumber(redis.call("INCR", key))
if current == 1 then
  redis.call("EXPIRE", key, window)
end
local ttl = redis.call("TTL", key)
if ttl < 0 then
  redis.call("EXPIRE", key, window)
  ttl = window
end
return { current, ttl }
`

export class NodeRedisRateLimiter implements RateLimiter {
  constructor(
    private readonly client: CacheClient,
    private readonly maxRequests: number,
    private readonly windowSeconds: number,
    private readonly prefix: string
  ) {}

  async limit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.prefix}:${identifier}`
    const result = (await this.client.eval(
      FIXED_WINDOW_LUA,
      [key],
      [String(this.maxRequests), String(this.windowSeconds)]
    )) as [number, number]

    const current = Number(result[0])
    const ttl = Number(result[1])

    return {
      success: current <= this.maxRequests,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - current),
      reset: Date.now() + ttl * 1000,
    }
  }
}
