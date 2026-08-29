/**
 * Rate limiter contract — shared types.
 *
 * Imported by every adapter and consumer. No runtime dependencies.
 */

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>
}

export interface RateLimiterConfig {
  maxRequests: number
  windowSeconds?: number
  prefix: string
}
